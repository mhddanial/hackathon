def calculate_emission_score(multipliers: list[float]) -> dict:
    """
    Calculate the estimated relative emission score based on a list of congestion multipliers
    for a chosen route. The higher the multiplier, the higher the emission
    because vehicles spend more time idling on the road.
    
    Args:
        multipliers: List of float (e.g. [1.0, 1.5, 2.1])
        
    Returns:
        dict: {"score": "Low"|"Medium"|"High", "value": float}
    """
    if not multipliers:
        return {"score": "Low", "value": 1.0}
        
    avg_multiplier = sum(multipliers) / len(multipliers)
    
    # Assumptions:
    # 1.0 - 1.29 -> Low (Smooth traffic)
    # 1.3 - 1.79 -> Medium (Light/Moderate congestion)
    # >= 1.8     -> High (Heavy congestion)
    if avg_multiplier >= 1.8:
        score = "High"
    elif avg_multiplier >= 1.3:
        score = "Medium"
    else:
        score = "Low"
        
    return {
        "score": score,
        "value": round(avg_multiplier, 2)
    }
