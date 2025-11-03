"""
Cinematic Image Prompt Generator
Creates hyper-realistic, metaphorical image prompts with NO TEXT
Following professional composition rules for LinkedIn posts
"""

def generate_cinematic_image_prompt(post_hook: str, post_full_content: str = "") -> str:
    """
    Generate a cinematic, metaphorical image prompt from post content
    
    Formula:
    [Emotion/Concept] -> [Subject in Environment] with [Key Metaphor] -> 
    [Lighting/Mood/Composition] -> [Color Palette] -> "No text overlay"
    
    Args:
        post_hook: The opening hook/first line of the post
        post_full_content: Full post content for additional context
    
    Returns:
        Cinematic image prompt string
    """
    
    # Extract key emotion/concept from the hook
    concept = extract_concept(post_hook)
    
    # Map concept to visual metaphor
    metaphor = get_visual_metaphor(concept, post_hook)
    
    # Build cinematic prompt with PHOTOREALISTIC emphasis and NO TEXT instructions
    prompt = f"""PROFESSIONAL PHOTOGRAPH (not illustration, not artwork, not cartoon) - PHOTOREALISTIC ONLY. 
Shot on professional DSLR camera, 35-mm lens, f1.8 aperture. Real photography, actual photo quality, documentary style.
A cinematic professional photograph showing {metaphor['subject']} in {metaphor['environment']}, 
with {metaphor['focal_object']} as the central focus - symbolizing {metaphor['meaning']}. 
Camera settings: {metaphor['lighting']} with {metaphor['color_palette']}. 
Professional photography with cinematic shadows, shallow depth of field, and a minimalist background to capture the {metaphor['emotional_moment']} moment. 
Shot composition: {metaphor['composition']}. 
Style: photojournalism, documentary photography, professional corporate photography, National Geographic quality.
AVOID: illustration style, cartoon style, digital art style, painting style, drawing style, anime style, comic style.
ABSOLUTELY NO TEXT - NO WORDS - NO LETTERS - NO TYPOGRAPHY OF ANY KIND. 
Zero text, zero typography, zero words, zero letters, zero numbers, zero captions, zero labels, zero signs, zero writing of any kind. 
Do NOT add any text. Pure photographic imagery ONLY. Real photograph quality."""
    
    return prompt.replace('\n', ' ').strip()


def extract_concept(hook: str) -> str:
    """
    Extract core concept from post hook
    """
    hook_lower = hook.lower()
    
    # Broader concept matching for more variety
    if any(word in hook_lower for word in ['simple', 'minimal', 'less', 'essential', 'clean', 'focus']):
        return 'simplicity_over_perfection'
    
    elif any(word in hook_lower for word in ['achiev', 'success', 'win', 'milestone', 'accomplished', 'reached', 'goal']):
        return 'achievement'
    
    elif any(word in hook_lower for word in ['fail', 'mistake', 'wrong', 'lesson', 'learn']):
        return 'learning_from_failure'
    
    elif any(word in hook_lower for word in ['action', 'start', 'begin', 'launch', 'move', 'step']):
        return 'taking_action'
    
    elif any(word in hook_lower for word in ['curious', 'wonder', 'question', 'why', 'how', 'explore', 'discover']):
        return 'curiosity'
    
    elif any(word in hook_lower for word in ['change', 'transform', 'evolve', 'shift', 'adapt']):
        return 'transformation'
    
    elif any(word in hook_lower for word in ['work', 'dedicate', 'effort', 'grind', 'hustle', 'persistent']):
        return 'hard_work'
    
    elif any(word in hook_lower for word in ['together', 'team', 'collaborate', 'partner', 'collective']):
        return 'collaboration'

    else:
        return 'professional_focus'


def get_visual_metaphor(concept: str, hook: str) -> dict:
    """
    Map concept to specific visual metaphor with cinematic details
    DIVERSE NATURAL METAPHORS - NO OFFICE/DESK/WORKSPACE SCENES
    
    Returns dict with:
    - subject: Main character/object
    - environment: Setting
    - focal_object: Key metaphorical element
    - meaning: What it symbolizes
    - lighting: Lighting description
    - color_palette: Color scheme
    - composition: Framing details
    - emotional_moment: The feeling being captured
    """
    
    metaphors = {
        'simplicity_over_perfection': {
            'subject': 'a single perfect water droplet creating concentric ripples on a still pond surface',
            'environment': 'a minimalist zen garden with smooth stones and calm water',
            'focal_object': 'the expanding ripple pattern radiating outward in perfect circles',
            'meaning': 'how small, simple actions create far-reaching impact',
            'lighting': 'soft morning light with gentle reflections dancing on water',
            'color_palette': 'serene blues, silver reflections, and white highlights with subtle teal',
            'composition': 'centered circular composition from directly above, ample negative space',
            'emotional_moment': 'peaceful clarity'
        },
        
        'achievement': {
            'subject': 'a lone hiker standing triumphantly on a mountain summit at sunrise',
            'environment': 'a majestic mountain peak with clouds below and vast sky above',
            'focal_object': 'a flag or raised arms silhouetted against the brilliant sunrise',
            'meaning': 'reaching goals and conquering challenges',
            'lighting': 'dramatic golden hour sunrise breaking through clouds with warm orange rays',
            'color_palette': 'gold, orange, deep purple shadows, and brilliant white highlights',
            'composition': 'heroic low-angle shot with subject on rule of thirds, expansive sky',
            'emotional_moment': 'victorious arrival'
        },
        
        'learning_from_failure': {
            'subject': 'a young tree sapling growing strong from a fallen, weathered log',
            'environment': 'a forest floor with decomposing wood giving life to new growth',
            'focal_object': 'vibrant green sprout emerging from dark, textured bark',
            'meaning': 'how setbacks nourish future success',
            'lighting': 'soft forest light filtering through canopy with a spotlight on the sprout',
            'color_palette': 'rich earth tones, vibrant green, amber sunlight, and deep shadows',
            'composition': 'intimate macro shot with shallow depth, foreground bokeh',
            'emotional_moment': 'hopeful renewal'
        },
        
        'taking_action': {
            'subject': 'a runner bursting forward from starting blocks in dramatic motion',
            'environment': 'an outdoor track with motion blur showing explosive movement',
            'focal_object': 'the precise moment feet leave the ground with powerful energy',
            'meaning': 'the decisive moment of commitment and forward momentum',
            'lighting': 'high-speed flash freezing action with natural stadium lighting',
            'color_palette': 'deep navy track, bright white lines, warm skin tones, dynamic orange',
            'composition': 'dynamic diagonal with motion blur, rule of thirds placement',
            'emotional_moment': 'explosive determination'
        },
        
        'curiosity': {
            'subject': 'a child peering through a magnifying glass at intricate patterns in nature',
            'environment': 'a sunlit garden with dewdrops and botanical details',
            'focal_object': 'magnified dewdrop revealing a rainbow prism of colors',
            'meaning': 'the power of curiosity revealing hidden beauty',
            'lighting': 'bright natural sunlight creating rainbow prism effects through glass',
            'color_palette': 'cool blues, rainbow spectrum highlights, emerald green, crystal clear',
            'composition': 'close-up with magnifying glass creating circular frame within frame',
            'emotional_moment': 'wonder and discovery'
        },
        
        'transformation': {
            'subject': 'a butterfly emerging from chrysalis with wings unfurling',
            'environment': 'a garden branch with soft natural background at dawn',
            'focal_object': 'the delicate wings spreading open revealing vibrant patterns',
            'meaning': 'metamorphosis from one state to limitless possibilities',
            'lighting': 'soft golden dawn light with backlit translucent wings glowing',
            'color_palette': 'warm amber, vibrant orange and blue wing patterns, soft green',
            'composition': 'intimate macro with wings centered, soft bokeh background',
            'emotional_moment': 'transformational emergence'
        },
        
        'hard_work': {
            'subject': 'a blacksmith hammering glowing metal on an anvil with flying sparks',
            'environment': 'a traditional forge with dramatic darkness surrounding the work area',
            'focal_object': 'molten red-hot metal being shaped with precision and force',
            'meaning': 'dedication and the forging of excellence through effort',
            'lighting': 'dramatic chiaroscuro with bright orange glow from metal illuminating scene',
            'color_palette': 'deep blacks, brilliant orange-red glow, gold sparks, warm amber',
            'composition': 'tight dynamic framing focused on hands and work, high contrast',
            'emotional_moment': 'intense dedication'
        },
        
        'collaboration': {
            'subject': 'a flock of birds flying in perfect V-formation against dramatic sky',
            'environment': 'an expansive sunset sky with clouds and open horizon',
            'focal_object': 'the synchronized formation creating a unified geometric pattern',
            'meaning': 'collective effort achieving what individuals cannot',
            'lighting': 'spectacular sunset with dramatic cloud lighting and silhouettes',
            'color_palette': 'warm orange, pink, purple sunset tones with dark blue silhouettes',
            'composition': 'wide-angle landscape with birds on golden ratio, vast sky',
            'emotional_moment': 'harmonious unity'
        },
        
        'professional_focus': {
            'subject': 'a master archer in zen concentration aiming at a distant target',
            'environment': 'a minimalist dojo or outdoor zen archery range with calm atmosphere',
            'focal_object': 'the drawn bow at full extension with arrow perfectly aligned',
            'meaning': 'absolute focus and intentional precision',
            'lighting': 'clean natural light with soft shadows creating depth and calm',
            'color_palette': 'neutral earth tones, deep browns, white, subtle jade green',
            'composition': 'profile shot with strong leading lines, generous negative space',
            'emotional_moment': 'meditative clarity'
        }
    }
    
    return metaphors.get(concept, metaphors['professional_focus'])


def generate_carousel_slide_prompt(slide_title: str, slide_content: str, slide_number: int, total_slides: int) -> str:
    """
    Generate cinematic prompt for carousel slides
    Maintains consistent style across slides while varying the metaphor
    """
    # Simpler metaphors for carousel to maintain consistency
    prompt = f"""PROFESSIONAL PHOTOGRAPH (not illustration, not artwork, not cartoon) - PHOTOREALISTIC ONLY.
Shot on professional DSLR camera, 35-mm lens. Real photography, documentary style.
A cinematic professional photograph showing the concept of "{slide_title}" 
through visual metaphor. Natural environment with {_get_carousel_focal_object(slide_number, total_slides)}. 
Camera settings: consistent soft natural lighting with warm color palette. 
Professional photography with cinematic shallow depth of field, clean background with negative space for overlay. 
Style: photojournalism, professional corporate photography, National Geographic quality.
AVOID: illustration style, cartoon style, digital art style, painting style, drawing style, any office or workspace settings.
ABSOLUTELY NO TEXT - NO WORDS - NO LETTERS - NO TYPOGRAPHY OF ANY KIND. 
Zero text, zero typography, zero words, zero letters, zero numbers, zero captions, zero labels, zero signs, zero writing. 
Do NOT add any text or words. Pure photographic imagery ONLY. Real photograph quality."""
    
    return prompt.replace('\n', ' ').strip()


def _get_carousel_focal_object(slide_num: int, total: int) -> str:
    """Generate varied focal objects for carousel consistency"""
    objects = [
        "sunlight breaking through morning mist in a forest",
        "geometric patterns in nature like honeycomb or leaves",
        "flowing water creating dynamic patterns over rocks",
        "birds in flight against a dramatic sky",
        "mountain peaks emerging from clouds",
        "close-up of natural textures like tree bark or stone",
        "dramatic weather patterns like storm clouds parting",
        "wildflowers in a meadow with shallow depth of field",
        "abstract reflections in still water",
        "sand dunes creating flowing geometric lines"
    ]
    return objects[slide_num % len(objects)]



def generate_cinematic_image_prompt(post_hook: str, post_full_content: str = "") -> str:
    """
    Generate a cinematic, metaphorical image prompt from post content
    
    Formula:
    [Emotion/Concept] -> [Subject in Environment] with [Key Metaphor] -> 
    [Lighting/Mood/Composition] -> [Color Palette] -> "No text overlay"
    
    Args:
        post_hook: The opening hook/first line of the post
        post_full_content: Full post content for additional context
    
    Returns:
        Cinematic image prompt string
    """
    
    # Extract key emotion/concept from the hook
    concept = extract_concept(post_hook)
    
    # Map concept to visual metaphor
    metaphor = get_visual_metaphor(concept, post_hook)
    
    # Build cinematic prompt with PHOTOREALISTIC emphasis and NO TEXT instructions
    prompt = f"""PROFESSIONAL PHOTOGRAPH (not illustration, not artwork, not cartoon) - PHOTOREALISTIC ONLY. 
Shot on professional DSLR camera, 35-mm lens, f1.8 aperture. Real photography, actual photo quality, documentary style.
A cinematic professional photograph showing {metaphor['subject']} in {metaphor['environment']}, 
with {metaphor['focal_object']} as the central focus - symbolizing {metaphor['meaning']}. 
Camera settings: {metaphor['lighting']} with {metaphor['color_palette']}. 
Professional photography with cinematic shadows, shallow depth of field, and a minimalist background to capture the {metaphor['emotional_moment']} moment. 
Shot composition: {metaphor['composition']}. 
Style: photojournalism, documentary photography, professional corporate photography, National Geographic quality.
AVOID: illustration style, cartoon style, digital art style, painting style, drawing style, anime style, comic style.
ABSOLUTELY NO TEXT - NO WORDS - NO LETTERS - NO TYPOGRAPHY OF ANY KIND. 
Zero text, zero typography, zero words, zero letters, zero numbers, zero captions, zero labels, zero signs, zero writing of any kind. 
Do NOT add any text. Pure photographic imagery ONLY. Real photograph quality."""
    
    return prompt.replace('\n', ' ').strip()


def extract_concept(hook: str) -> str:
    """
    Extract core concept from post hook
    """
    hook_lower = hook.lower()
    
    # Broader concept matching for more variety
    if any(word in hook_lower for word in ['simple', 'minimal', 'less', 'essential', 'clean', 'focus']):
        return 'simplicity_over_perfection'
    
    elif any(word in hook_lower for word in ['achiev', 'success', 'win', 'milestone', 'accomplished', 'reached', 'goal']):
        return 'achievement'
    
    elif any(word in hook_lower for word in ['fail', 'mistake', 'wrong', 'lesson', 'learn']):
        return 'learning_from_failure'
    
    elif any(word in hook_lower for word in ['action', 'start', 'begin', 'launch', 'move', 'step']):
        return 'taking_action'
    
    elif any(word in hook_lower for word in ['curious', 'wonder', 'question', 'why', 'how', 'explore', 'discover']):
        return 'curiosity'
    
    elif any(word in hook_lower for word in ['change', 'transform', 'evolve', 'shift', 'adapt']):
        return 'transformation'
    
    elif any(word in hook_lower for word in ['work', 'dedicate', 'effort', 'grind', 'hustle', 'persistent']):
        return 'hard_work'
    
    elif any(word in hook_lower for word in ['together', 'team', 'collaborate', 'partner', 'collective']):
        return 'collaboration'

    else:
        return 'professional_focus'


def get_visual_metaphor(concept: str, hook: str) -> dict:
    """
    Map concept to specific visual metaphor with cinematic details
    DIVERSE NATURAL METAPHORS - NO OFFICE/DESK/WORKSPACE SCENES
    
    Returns dict with:
    - subject: Main character/object
    - environment: Setting
    - focal_object: Key metaphorical element
    - meaning: What it symbolizes
    - lighting: Lighting description
    - color_palette: Color scheme
    - composition: Framing details
    - emotional_moment: The feeling being captured
    """
    
    metaphors = {
        'simplicity_over_perfection': {
            'subject': 'a single perfect water droplet creating concentric ripples on a still pond surface',
            'environment': 'a minimalist zen garden with smooth stones and calm water',
            'focal_object': 'the expanding ripple pattern radiating outward in perfect circles',
            'meaning': 'how small, simple actions create far-reaching impact',
            'lighting': 'soft morning light with gentle reflections dancing on water',
            'color_palette': 'serene blues, silver reflections, and white highlights with subtle teal',
            'composition': 'centered circular composition from directly above, ample negative space',
            'emotional_moment': 'peaceful clarity'
        },
        
        'achievement': {
            'subject': 'a lone hiker standing triumphantly on a mountain summit at sunrise',
            'environment': 'a majestic mountain peak with clouds below and vast sky above',
            'focal_object': 'a flag or raised arms silhouetted against the brilliant sunrise',
            'meaning': 'reaching goals and conquering challenges',
            'lighting': 'dramatic golden hour sunrise breaking through clouds with warm orange rays',
            'color_palette': 'gold, orange, deep purple shadows, and brilliant white highlights',
            'composition': 'heroic low-angle shot with subject on rule of thirds, expansive sky',
            'emotional_moment': 'victorious arrival'
        },
        
        'learning_from_failure': {
            'subject': 'a young tree sapling growing strong from a fallen, weathered log',
            'environment': 'a forest floor with decomposing wood giving life to new growth',
            'focal_object': 'vibrant green sprout emerging from dark, textured bark',
            'meaning': 'how setbacks nourish future success',
            'lighting': 'soft forest light filtering through canopy with a spotlight on the sprout',
            'color_palette': 'rich earth tones, vibrant green, amber sunlight, and deep shadows',
            'composition': 'intimate macro shot with shallow depth, foreground bokeh',
            'emotional_moment': 'hopeful renewal'
        },
        
        'taking_action': {
            'subject': 'a runner bursting forward from starting blocks in dramatic motion',
            'environment': 'an outdoor track with motion blur showing explosive movement',
            'focal_object': 'the precise moment feet leave the ground with powerful energy',
            'meaning': 'the decisive moment of commitment and forward momentum',
            'lighting': 'high-speed flash freezing action with natural stadium lighting',
            'color_palette': 'deep navy track, bright white lines, warm skin tones, dynamic orange',
            'composition': 'dynamic diagonal with motion blur, rule of thirds placement',
            'emotional_moment': 'explosive determination'
        },
        
        'curiosity': {
            'subject': 'a child peering through a magnifying glass at intricate patterns in nature',
            'environment': 'a sunlit garden with dewdrops and botanical details',
            'focal_object': 'magnified dewdrop revealing a rainbow prism of colors',
            'meaning': 'the power of curiosity revealing hidden beauty',
            'lighting': 'bright natural sunlight creating rainbow prism effects through glass',
            'color_palette': 'cool blues, rainbow spectrum highlights, emerald green, crystal clear',
            'composition': 'close-up with magnifying glass creating circular frame within frame',
            'emotional_moment': 'wonder and discovery'
        },
        
        'transformation': {
            'subject': 'a butterfly emerging from chrysalis with wings unfurling',
            'environment': 'a garden branch with soft natural background at dawn',
            'focal_object': 'the delicate wings spreading open revealing vibrant patterns',
            'meaning': 'metamorphosis from one state to limitless possibilities',
            'lighting': 'soft golden dawn light with backlit translucent wings glowing',
            'color_palette': 'warm amber, vibrant orange and blue wing patterns, soft green',
            'composition': 'intimate macro with wings centered, soft bokeh background',
            'emotional_moment': 'transformational emergence'
        },
        
        'hard_work': {
            'subject': 'a blacksmith hammering glowing metal on an anvil with flying sparks',
            'environment': 'a traditional forge with dramatic darkness surrounding the work area',
            'focal_object': 'molten red-hot metal being shaped with precision and force',
            'meaning': 'dedication and the forging of excellence through effort',
            'lighting': 'dramatic chiaroscuro with bright orange glow from metal illuminating scene',
            'color_palette': 'deep blacks, brilliant orange-red glow, gold sparks, warm amber',
            'composition': 'tight dynamic framing focused on hands and work, high contrast',
            'emotional_moment': 'intense dedication'
        },
        
        'collaboration': {
            'subject': 'a flock of birds flying in perfect V-formation against dramatic sky',
            'environment': 'an expansive sunset sky with clouds and open horizon',
            'focal_object': 'the synchronized formation creating a unified geometric pattern',
            'meaning': 'collective effort achieving what individuals cannot',
            'lighting': 'spectacular sunset with dramatic cloud lighting and silhouettes',
            'color_palette': 'warm orange, pink, purple sunset tones with dark blue silhouettes',
            'composition': 'wide-angle landscape with birds on golden ratio, vast sky',
            'emotional_moment': 'harmonious unity'
        },
        
        'professional_focus': {
            'subject': 'a master archer in zen concentration aiming at a distant target',
            'environment': 'a minimalist dojo or outdoor zen archery range with calm atmosphere',
            'focal_object': 'the drawn bow at full extension with arrow perfectly aligned',
            'meaning': 'absolute focus and intentional precision',
            'lighting': 'clean natural light with soft shadows creating depth and calm',
            'color_palette': 'neutral earth tones, deep browns, white, subtle jade green',
            'composition': 'profile shot with strong leading lines, generous negative space',
            'emotional_moment': 'meditative clarity'
        }
    }
    
    return metaphors.get(concept, metaphors['professional_focus'])


def generate_carousel_slide_prompt(slide_title: str, slide_content: str, slide_number: int, total_slides: int) -> str:
    """
    Generate cinematic prompt for carousel slides
    Maintains consistent style across slides while varying the metaphor
    """
    # Simpler metaphors for carousel to maintain consistency
    prompt = f"""PROFESSIONAL PHOTOGRAPH (not illustration, not artwork, not cartoon) - PHOTOREALISTIC ONLY.
Shot on professional DSLR camera, 35-mm lens. Real photography, documentary style.
A cinematic professional photograph showing the concept of "{slide_title}" 
through visual metaphor. Natural environment with {_get_carousel_focal_object(slide_number, total_slides)}. 
Camera settings: consistent soft natural lighting with warm color palette. 
Professional photography with cinematic shallow depth of field, clean background with negative space for overlay. 
Style: photojournalism, professional corporate photography, National Geographic quality.
AVOID: illustration style, cartoon style, digital art style, painting style, drawing style, any office or workspace settings.
ABSOLUTELY NO TEXT - NO WORDS - NO LETTERS - NO TYPOGRAPHY OF ANY KIND. 
Zero text, zero typography, zero words, zero letters, zero numbers, zero captions, zero labels, zero signs, zero writing. 
Do NOT add any text or words. Pure photographic imagery ONLY. Real photograph quality."""
    
    return prompt.replace('\n', ' ').strip()


def _get_carousel_focal_object(slide_num: int, total: int) -> str:
    """Generate varied focal objects for carousel consistency"""
    objects = [
        "sunlight breaking through morning mist in a forest",
        "geometric patterns in nature like honeycomb or leaves",
        "flowing water creating dynamic patterns over rocks",
        "birds in flight against a dramatic sky",
        "mountain peaks emerging from clouds",
        "close-up of natural textures like tree bark or stone",
        "dramatic weather patterns like storm clouds parting",
        "wildflowers in a meadow with shallow depth of field",
        "abstract reflections in still water",
        "sand dunes creating flowing geometric lines"
    ]
    return objects[slide_num % len(objects)]

