from langgraph.graph import StateGraph, START, END
from app.agent.state import OpsMemoryState
from app.agent.nodes import (
    load_incident_node,
    generate_fingerprint_node,
    recall_memory_node,
    collect_evidence_node,
    check_historical_corrections_node,
    analyze_incident_node,
    generate_diagnosis_node,
    handle_correction_node,
    resolution_node,
    retain_learning_node
)
from app.agent.edges import route_human_review

def create_opsmemory_graph():
    """
    Constructs the OpsMemory LangGraph workflow.
    """
    builder = StateGraph(OpsMemoryState)

    # Add Nodes
    builder.add_node("load_incident", load_incident_node)
    builder.add_node("generate_fingerprint", generate_fingerprint_node)
    builder.add_node("recall_memory", recall_memory_node)
    builder.add_node("collect_evidence", collect_evidence_node)
    builder.add_node("check_historical_corrections", check_historical_corrections_node)
    builder.add_node("analyze_incident", analyze_incident_node)
    builder.add_node("generate_diagnosis", generate_diagnosis_node)
    builder.add_node("handle_correction", handle_correction_node)
    builder.add_node("resolution", resolution_node)
    builder.add_node("retain_learning", retain_learning_node)

    # Linear workflow from START to generate_diagnosis
    builder.add_edge(START, "load_incident")
    builder.add_edge("load_incident", "generate_fingerprint")
    builder.add_edge("generate_fingerprint", "recall_memory")
    builder.add_edge("recall_memory", "collect_evidence")
    builder.add_edge("collect_evidence", "check_historical_corrections")
    builder.add_edge("check_historical_corrections", "analyze_incident")
    builder.add_edge("analyze_incident", "generate_diagnosis")

    # Conditional human review branch
    builder.add_conditional_edges(
        "generate_diagnosis",
        route_human_review,
        {
            "handle_correction": "handle_correction",
            "resolution": "resolution",
            "analyze_incident": "analyze_incident",
            "__end__": END
        }
    )

    # Post-correction flow
    builder.add_edge("handle_correction", "resolution")
    builder.add_edge("resolution", "retain_learning")
    builder.add_edge("retain_learning", END)

    return builder.compile()

opsmemory_graph = create_opsmemory_graph()
