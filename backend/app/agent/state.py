from typing import TypedDict, Optional, List, Dict, Any

class OpsMemoryState(TypedDict):
    """
    Strongly typed LangGraph state for OpsMemory incident investigation workflow.
    """
    incident_id: int
    incident_code: str
    service: str
    environment: str
    deployment_id: Optional[int]
    symptoms: str

    current_logs: str
    current_changes: List[Dict[str, Any]]

    failure_fingerprint: str
    fingerprint_details: Dict[str, Any]

    recalled_memories: List[Dict[str, Any]]
    historical_corrections: List[Dict[str, Any]]
    historical_resolutions: List[Dict[str, Any]]

    agent_hypotheses: List[str]
    initial_diagnosis: Dict[str, Any]

    human_action: Optional[str] # "confirm", "correct", "reject"
    human_correction: Optional[Dict[str, Any]]

    confirmed_root_cause: Optional[str]
    recommended_actions: List[str]
    selected_action: Optional[str]

    resolution_outcome: Optional[Dict[str, Any]]
    learning_summary: Optional[str]
    stage_logs: List[Dict[str, Any]]

    # Safe Automation & Self-Recovery Subsystem
    automation_candidate: Optional[Dict[str, Any]]
    automation_action: Optional[Dict[str, Any]]
    automation_decision: Optional[str]

