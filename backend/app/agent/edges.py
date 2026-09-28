from typing import Literal
from app.agent.state import OpsMemoryState

def route_human_review(state: OpsMemoryState) -> Literal["handle_correction", "resolution", "analyze_incident", "__end__"]:
    """
    Conditional routing function based on engineer interaction.
    """
    action = state.get("human_action")
    if action == "correct":
        return "handle_correction"
    elif action == "confirm":
        return "resolution"
    elif action == "reject":
        return "analyze_incident"
    
    # If no action provided yet, complete the initial diagnostic stage
    return "__end__"
