import os
import json
import logging
from typing import Optional, List, Dict, Any
from app.config import settings

logger = logging.getLogger("opsmemory.hindsight")

# Try to import official hindsight client
try:
    from hindsight_client import Hindsight
    HINDSIGHT_CLIENT_AVAILABLE = True
except Exception as e:
    logger.warning(f"Could not import hindsight_client: {e}")
    HINDSIGHT_CLIENT_AVAILABLE = False
    Hindsight = None


class HindsightService:
    """
    Hindsight Long-Term Memory Service.
    Wraps the official Hindsight SDK with real API connectivity, multi-tenant bank isolation,
    and a persistent local memory bank with clear status indicators.
    """

    def __init__(self):
        self.api_key = settings.HINDSIGHT_API_KEY
        self.base_url = settings.HINDSIGHT_BASE_URL
        self.bank_id = settings.HINDSIGHT_BANK_ID or "opsmemory-demo"
        self.client = None
        self.is_real = False
        self._init_client()

        # Local persistent memory store for fallback/demo guarantees
        self.local_store_file = "opsmemory_hindsight_local_bank.json"
        self._load_local_store()

    def _init_client(self):
        if HINDSIGHT_CLIENT_AVAILABLE and self.api_key and len(self.api_key) > 5 and not self.api_key.startswith("your_"):
            try:
                self.client = Hindsight(api_key=self.api_key, base_url=self.base_url)
                self.is_real = True
                logger.info(f"Hindsight client initialized in REAL mode for bank: {self.bank_id}")
            except Exception as e:
                logger.warning(f"Failed to initialize real Hindsight client: {e}. Falling back to local memory store.")
                self.client = None
                self.is_real = False
        else:
            self.is_real = False
            logger.info("Operating Hindsight memory service (Demo & Local store active).")

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": "Connected" if (self.is_real or len(self.local_memories) > 0) else "Ready",
            "mode": "REAL" if self.is_real else "FALLBACK",
            "bank_id": self.bank_id,
            "total_memories": len(self.local_memories),
            "client_available": HINDSIGHT_CLIENT_AVAILABLE
        }

    def _load_local_store(self):
        self.local_memories: List[Dict[str, Any]] = []
        if os.path.exists(self.local_store_file):
            try:
                with open(self.local_store_file, "r", encoding="utf-8") as f:
                    self.local_memories = json.load(f)
            except Exception as e:
                logger.error(f"Error reading local hindsight store: {e}")
                self.local_memories = []

    def _save_local_store(self):
        try:
            with open(self.local_store_file, "w", encoding="utf-8") as f:
                json.dump(self.local_memories, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving local hindsight store: {e}")

    def _get_org_bank(self, org_id: Optional[int] = None) -> str:
        if org_id and org_id != 1:
            return f"opsmemory-org-{org_id}"
        return self.bank_id

    def retain(
        self,
        contents: str,
        memory_type: str = "incident",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        org_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Retains operational experience into Hindsight organizational memory.
        """
        tags = tags or []
        metadata = metadata or {}
        bank = self._get_org_bank(org_id)
        memory_id = f"mem_{len(self.local_memories) + 1}_{metadata.get('incident_code', 'INC')}"
        
        entry = {
            "id": memory_id,
            "bank_id": bank,
            "org_id": org_id or 1,
            "memory_type": memory_type,
            "contents": contents,
            "tags": tags,
            "metadata": metadata,
            "created_at": metadata.get("timestamp") or "2026-09-28T06:00:00Z"
        }

        # If real client is connected, retain to Hindsight API
        if self.is_real and self.client:
            try:
                self.client.retain(
                    bank_id=bank,
                    contents=contents,
                    tags=tags,
                    metadata=metadata
                )
                logger.info(f"Retained memory into REAL Hindsight bank {bank}")
            except Exception as e:
                logger.error(f"Error retaining memory to real Hindsight API: {e}")

        # Always save locally so system remains consistent and searchable
        self.local_memories.append(entry)
        self._save_local_store()

        return entry

    def recall(
        self,
        query: str,
        tags: Optional[List[str]] = None,
        limit: int = 5,
        org_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Recalls relevant organizational memories based on query, tags, and tenant isolation.
        """
        tags = tags or []
        bank = self._get_org_bank(org_id)
        results = []

        # Try real client if available
        if self.is_real and self.client:
            try:
                real_resp = self.client.recall(
                    bank_id=bank,
                    query=query,
                    tags=tags
                )
                if hasattr(real_resp, "results"):
                    for r in real_resp.results:
                        results.append({
                            "id": getattr(r, "id", f"mem_{len(results)}"),
                            "contents": getattr(r, "contents", str(r)),
                            "metadata": getattr(r, "metadata", {}),
                            "tags": getattr(r, "tags", []),
                            "source": "hindsight_real"
                        })
                return results
            except Exception as e:
                logger.error(f"Error during real Hindsight recall: {e}. Using local store.")

        # Local semantic & tag matcher with tenant filtering
        target_org = org_id or 1
        q_tokens = set(query.lower().replace("_", " ").split())
        scored = []
        for mem in self.local_memories:
            if mem.get("org_id", 1) != target_org:
                continue

            score = 0
            # Tag match bonus
            mem_tags = [t.lower() for t in mem.get("tags", [])]
            for t in tags:
                if t.lower() in mem_tags:
                    score += 5
            
            # Content match
            mem_content = mem.get("contents", "").lower()
            for token in q_tokens:
                if len(token) > 2 and token in mem_content:
                    score += 1
            
            # Fingerprint exact match bonus
            mem_fp = mem.get("metadata", {}).get("failure_fingerprint", "")
            if mem_fp and mem_fp.lower() in query.lower():
                score += 10
            
            if score > 0 or len(self.local_memories) <= 3:
                scored.append((score, mem))

        # Sort descending by score
        scored.sort(key=lambda x: x[0], reverse=True)
        return [s[1] for s in scored[:limit]]

    def reflect(self, query: str, org_id: Optional[int] = None) -> str:
        """
        Reflects over organizational knowledge base to formulate higher-level conclusions.
        """
        bank = self._get_org_bank(org_id)
        if self.is_real and self.client:
            try:
                resp = self.client.reflect(bank_id=bank, query=query)
                return str(resp)
            except Exception as e:
                logger.error(f"Error during real Hindsight reflect: {e}")

        # Local reflection over stored engineering insights
        recalled = self.recall(query, limit=5, org_id=org_id)
        if not recalled:
            return "No historical pattern exists for this incident fingerprint."
        
        reflections = []
        for r in recalled:
            m_type = r.get("memory_type", "incident")
            reflections.append(f"- [{m_type.upper()}]: {r.get('contents')}")
        
        return "Organizational Reflections:\n" + "\n".join(reflections)

    def list_all(self, limit: int = 50, org_id: Optional[int] = None) -> List[Dict[str, Any]]:
        target_org = org_id or 1
        filtered = [m for m in self.local_memories if m.get("org_id", 1) == target_org]
        return filtered[-limit:]

# Singleton instance
hindsight_service = HindsightService()
