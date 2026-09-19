"""Deterministic development classifier. Replace behind the classify() contract."""

CATEGORIES = {
    "Flooding": ["flood", "submerged", "waterlogged", "inundat"],
    "Cyclone": ["cyclone", "landfall"],
    "Hailstorm": ["hail"],
    "Lightning": ["lightning"],
    "Thunderstorm": ["thunder"],
    "Heatwave": ["heatwave", "extreme heat", "heat wave"],
    "Fog": ["fog"],
    "Dust Storm": ["dust storm", "sandstorm"],
    "Strong Winds": ["gust", "strong wind"],
    "Rainfall": ["rain", "downpour", "precipitation"],
}


def classify(text):
    text = text.lower()
    for label, words in CATEGORIES.items():
        if any(w in text for w in words):
            return {
                "event_type": label,
                "confidence": 0.94 if label == "Flooding" else 0.86,
                "model": "deterministic-v1",
            }
    return {"event_type": "Other", "confidence": 0.35, "model": "deterministic-v1"}
