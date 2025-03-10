from flask import Blueprint, render_template, request, jsonify
from app.utils import (
    fetch_chat_response, 
    compute_saliency, 
    get_attention_map, 
    build_3d_attention_figure
)
import json

main = Blueprint('main', __name__)

# Client-side cache for saliency data
saliency_cache = {}

@main.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        user_message = request.form.get('message')
        temperature = float(request.form.get('temperature', 0.7))
        top_p = float(request.form.get('top_p', 0.9))
        top_k = int(request.form.get('top_k', 50))
        presence_penalty = float(request.form.get('presence_penalty', 0.0))
        max_tokens = int(request.form.get('max_tokens', 200))
        
        # Get response from the model
        response, _ = fetch_chat_response(
            user_message, 
            temperature, 
            top_p, 
            top_k, 
            presence_penalty, 
            max_tokens
        )
        
        return jsonify({'response': response})
    
    return render_template('index.html')

@main.route('/saliency', methods=['POST'])
def saliency():
    data = request.json
    text = data.get('text', '')
    
    # Check if we already have this saliency data cached
    if text in saliency_cache:
        return jsonify(saliency_cache[text])
    
    try:
        # Compute saliency and cache it
        saliency_data = compute_saliency(text)
        saliency_cache[text] = saliency_data
        return jsonify(saliency_data)
    except Exception as e:
        return jsonify({'error': str(e)})

@main.route('/attention-graph', methods=['POST'])
def attention_graph():
    data = request.json
    text = data.get('text', '')
    context = data.get('context', '')
    layer = int(data.get('layer', 0))
    head = int(data.get('head', 0))
    threshold = float(data.get('threshold', 0.01))
    
    try:
        # Get attention maps for all layers and heads
        attention_maps, input_ids = get_attention_map(text, context)
        
        # Build 3D figure for the specified layer and head
        fig = build_3d_attention_figure(attention_maps, input_ids, layer, head, threshold)
        
        # Convert to JSON for sending to the client
        fig_json = fig.to_json()
        return fig_json
    except Exception as e:
        print(f"Error generating attention graph: {str(e)}")
        return jsonify({'error': str(e)})

@main.route('/layer-head-info', methods=['GET'])
def layer_head_info():
    """Return information about available layers and heads for the model"""
    # This would ideally be dynamic based on the model, but for now we'll hardcode
    return jsonify({
        'layers': 12,  # Example for a 12-layer model
        'heads': 12    # Example for 12 attention heads per layer
    })

