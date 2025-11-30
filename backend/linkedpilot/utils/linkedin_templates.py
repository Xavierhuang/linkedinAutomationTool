import hashlib
from datetime import datetime
from typing import Dict, List


LINKEDIN_TEMPLATE_LIBRARY: List[Dict] = [
    {
        "id": "how_to",
        "label": "How-To Playbook",
        "description": "Mirrors the proven 'How to / The Secret to' pattern — promise a result, then reveal the steps.",
        "structure": [
            "Hook: 'How to ...' or 'The secret to ...' + outcome",
            "Context line that empathizes with the reader",
            "3-5 concise steps, each with the benefit baked in",
            "Proof or credibility moment",
            "Question-style CTA"
        ],
        "cta_examples": [
            "Which step holds you back right now?",
            "Want the walkthrough?",
            "Where would you start?"
        ],
        "image_focus": "Clean checklist or macro shot of someone taking action; emphasize clarity."
    },
    {
        "id": "rant",
        "label": "Constructive Rant",
        "description": "Pattern from Linked Coach where a controlled rant surfaces a shared frustration before offering a fix.",
        "structure": [
            "Open with a shocked question or bold statement about a shared frustration",
            "Describe the frustrating behavior in vivid detail",
            "Acknowledge rare exceptions (keeps tone thoughtful)",
            "Explain the ripple effect on teams/customers",
            "Offer a better playbook + invite readers to weigh in"
        ],
        "cta_examples": [
            "What would you do in this situation?",
            "Seen this lately?",
            "How do you handle it?"
        ],
        "image_focus": "High-contrast portrait or candid workplace shot that conveys tension but stays professional."
    },
    {
        "id": "polarize",
        "label": "Bold Polarization",
        "description": "A contrarian opener that states what most people get wrong, inspired by Justin Welsh style notes in the article.",
        "structure": [
            "Contrarian hook ('Doing X? It's slowing you down.')",
            "Explain the default approach and why it fails",
            "Reveal the alternative point of view",
            "Back it with one example or short anecdote",
            "CTA that asks readers to pick a side"
        ],
        "cta_examples": [
            "Which camp are you in?",
            "Still believe in the old playbook?",
            "Change my mind?"
        ],
        "image_focus": "Split-frame or diagonal composition highlighting contrast (e.g., old vs new)."
    },
    {
        "id": "data",
        "label": "Data Drop",
        "description": "Lead with a surprising stat, unpack what it means, and turn it into action — straight from the Linked Coach templates.",
        "structure": [
            "Hook with metric or percentage and why it matters",
            "Break down the insight in 2-3 micro paragraphs",
            "Highlight the implication for the reader",
            "Provide 2-3 action bullets or watch-outs",
            "End with CTA asking how they're tracking the metric"
        ],
        "cta_examples": [
            "Tracking this number yet?",
            "What does your dashboard say?",
            "Would this change your plan?"
        ],
        "image_focus": "Abstract data viz, dashboard close-up, or macro shot of analytics to reinforce credibility."
    },
    {
        "id": "three_things",
        "label": "Three Things List",
        "description": "Classic 'There are 3 things...' roundup that keeps each point punchy and skimmable.",
        "structure": [
            "Hook line: 'There are 3 things ...' or '3 reasons ...'",
            "Three numbered points with bolded keyword + one-liner",
            "Optional bonus tip or 'skip this at your own risk'",
            "CTA inviting readers to add a fourth idea"
        ],
        "cta_examples": [
            "What's your number four?",
            "Which one hits hardest?",
            "Add yours?"
        ],
        "image_focus": "4:5 portrait crop with generous negative space for overlay text."
    }
]


IMAGE_STYLE_ROTATION = [
    {
        "id": "portrait_45",
        "label": "Portrait Focus 4:5",
        "ratio": "1080x1350 (4:5)",
        "orientation": "vertical",
        "description": "LinkedIn feed favorite. Keep subject centered with 20% headroom so overlays breathe (per Figma size guide).",
        "caption_recipe": "Describe a confident portrait or close-up gesture connected to the post's emotion."
    },
    {
        "id": "wide_story",
        "label": "Wide Story 1.91:1",
        "ratio": "1200x628 (1.91:1)",
        "orientation": "horizontal",
        "description": "Best for thought-leadership link posts. Highlight horizon lines or collaborative scenes.",
        "caption_recipe": "Reference dynamic teamwork or sweeping workspace visuals."
    },
    {
        "id": "square_workspace",
        "label": "Editorial Square",
        "ratio": "1080x1080 (1:1)",
        "orientation": "square",
        "description": "Square crops land well across desktop + mobile. Use layered desk elements or product hero shots.",
        "caption_recipe": "Call out the focal object and the action taking place around it."
    }
]


def _hash_seed(*parts: str) -> int:
    seed = "::".join(part or "" for part in parts)
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest(), 16)


def pick_linkedin_template(org_id: str = "", topic: str = "") -> Dict:
    """Rotate through templates per org to avoid repetition."""
    # Use week number to keep rotation fresh without storing state
    week = datetime.utcnow().isocalendar()[1]
    idx = _hash_seed(org_id, topic, str(week)) % len(LINKEDIN_TEMPLATE_LIBRARY)
    return LINKEDIN_TEMPLATE_LIBRARY[idx]


def build_template_prompt(template: Dict, tone: str) -> str:
    structure_lines = "\n- ".join(template["structure"])
    ctas = ", ".join(template["cta_examples"])
    return (
        f"Template: {template['label']}\n"
        f"Description: {template['description']}\n"
        f"Structure:\n- {structure_lines}\n"
        f"CTA cues (pick one or remix): {ctas}\n"
        f"Tone to blend: {tone}."
    )


def pick_image_style(org_id: str = "", template_id: str = "") -> Dict:
    week = datetime.utcnow().isocalendar()[1]
    idx = _hash_seed(template_id, org_id, str(week)) % len(IMAGE_STYLE_ROTATION)
    return IMAGE_STYLE_ROTATION[idx]


def build_image_caption_brief(topic: str, template: Dict, image_style: Dict) -> str:
    """Return a short instruction for LLM to describe supporting visual."""
    topic_phrase = topic or "the idea"
    return (
        f"Capture a {image_style['label']} scene ({image_style['ratio']}) that reinforces {topic_phrase}. "
        f"{image_style['description']} {template['image_focus']}"
    )






