import os
import random
import torch
import networkx as nx
import plotly.graph_objects as go
from openai import OpenAI
from transformers import AutoTokenizer, AutoModelForCausalLM

# ------------------------------------------------------------------------
# 1. Nebius-based Chat Function (unchanged, except for placeholders).
# ------------------------------------------------------------------------
def fetch_chat_response(user_input, temperature, top_p, top_k, presence_penalty, max_tokens):
    """
    Calls Nebius Studio's Chat Completion endpoint to get a model response.
    (Placeholder: Also returns random attention_data. Replace with real attention if desired.)
    """
    client = OpenAI(
        base_url="https://api.studio.nebius.com/v1/",
        api_key=os.environ.get("NEBIUS_API_KEY")
    )

    messages = [
        {
            "role": "user",
            "content": user_input
        }
    ]

    response = client.chat.completions.create(
        model="meta-llama/Llama-3.2-1B-Instruct",
        temperature=temperature,
        top_p=top_p,
        # top_k, presence_penalty, max_tokens might or might not be recognized by Nebius
        messages=messages
    )

    chat_response = response.choices[0].message.content

    # Placeholder: random attention for the user input
    num_tokens = len(user_input.split())
    tokens = [f"Token{i}" for i in range(num_tokens)]
    attention_data = {
        "tokens": tokens,
        "attention": [
            [random.random() for _ in range(num_tokens)]
            for _ in range(num_tokens)
        ]
    }

    return chat_response, attention_data

def get_attention_data():
    """ Returns simulated attention data (unused or optional). """
    return {
        'tokens': ["Token1", "Token2", "Token3"],
        'attention': [
            [0.1, 0.2, 0.7],
            [0.3, 0.4, 0.3],
            [0.6, 0.1, 0.3]
        ]
    }

# ------------------------------------------------------------------------
# 2. Saliency Code (unchanged).
# ------------------------------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

saliency_tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-1B-Instruct")
saliency_model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-1B-Instruct")
saliency_model.to(device)
saliency_model.eval()

def compute_saliency(text):
    """
    Compute gradient-based saliency for the given text, returning { tokens, saliency }.
    """
    inputs = saliency_tokenizer(text, return_tensors="pt").to(device)
    input_ids = inputs["input_ids"]

    embedding_layer = saliency_model.get_input_embeddings()
    embeddings = embedding_layer(input_ids)
    embeddings = embeddings.detach().requires_grad_(True)

    outputs = saliency_model(inputs_embeds=embeddings)
    logits = outputs.logits

    score = logits.sum()
    saliency_model.zero_grad()
    score.backward()

    gradients = embeddings.grad[0]  # (seq_len, embedding_dim)
    saliency = gradients.norm(dim=1).detach().cpu().numpy().tolist()
    tokens = saliency_tokenizer.convert_ids_to_tokens(input_ids[0])

    torch.cuda.empty_cache()
    return {"tokens": tokens, "saliency": saliency}

# ------------------------------------------------------------------------
# 3. Real Attention Map + 3D Figure Code
# ------------------------------------------------------------------------

# If you want to use the *same* local model for attention as you do for saliency,
# you can reuse saliency_model. But for clarity, we define a new one here.
# (Alternatively, rename these to "attention_model"/"attention_tokenizer" if you prefer.)
attention_tokenizer = saliency_tokenizer
attention_model = saliency_model

def get_attention_map(text, context=""):
    """
    Returns all layer's attention maps plus the input IDs.
    attention_maps: list of shape (num_layers) where each item is (num_heads, seq_len, seq_len)
    input_ids: list of token IDs for labeling.
    
    The local model is used with output_attentions=True to get real attention weights.
    """
    combined_text = context + " " + text if context else text
    inputs = attention_tokenizer(combined_text, return_tensors="pt").to(device)

    with torch.no_grad():
        outputs = attention_model(**inputs, output_attentions=True)

    # outputs.attentions is a tuple: (num_layers, batch_size, num_heads, seq_len, seq_len)
    # We'll remove the batch dimension and convert to numpy.
    attentions = outputs.attentions  # length = num_layers
    attention_maps = [attn.squeeze(0).cpu().numpy() for attn in attentions]
    input_ids = inputs["input_ids"].squeeze(0).tolist()

    return attention_maps, input_ids

def build_3d_attention_figure(attention_maps, input_ids, layer=0, head=0, threshold=0.01):
    """
    Creates a 3D Plotly figure from a single attention head's matrix, using a NetworkX 3D layout.
    Returns a Plotly Figure object.
    """
    # Convert IDs to tokens, removing leading "Ġ" or other markers.
    token_labels = [t.lstrip("Ġ") for t in attention_tokenizer.convert_ids_to_tokens(input_ids)]

    # attention_maps[layer][head] => shape: (seq_len, seq_len)
    attn_matrix = attention_maps[layer][head]
    num_tokens = len(token_labels)

    # Build a directed graph
    G = nx.DiGraph()
    for i in range(num_tokens):
        G.add_node(i, label=token_labels[i])

    # Add edges with attention weights above a threshold
    edges = []
    for i in range(num_tokens):
        for j in range(num_tokens):
            weight = attn_matrix[i][j]
            if weight > threshold:
                G.add_edge(i, j, weight=weight)
                edges.append((i, j, weight))

    # 3D spring layout
    pos = nx.spring_layout(G, dim=3, seed=42)

    # Normalize for line widths
    max_weight = max([w for (_, _, w) in edges]) if edges else 1.0

    # Build edge traces
    edge_traces = []
    for (src, dst, w) in edges:
        x0, y0, z0 = pos[src]
        x1, y1, z1 = pos[dst]
        width = 5 * (w / max_weight)
        edge_trace = go.Scatter3d(
            x=[x0, x1],
            y=[y0, y1],
            z=[z0, z1],
            mode='lines',
            line=dict(color='blue', width=width),
            hoverinfo='none'
        )
        edge_traces.append(edge_trace)

    # Node trace
    node_x, node_y, node_z, node_text = [], [], [], []
    for i in G.nodes():
        x, y, z = pos[i]
        node_x.append(x)
        node_y.append(y)
        node_z.append(z)
        node_text.append(G.nodes[i]['label'])

    node_trace = go.Scatter3d(
        x=node_x,
        y=node_y,
        z=node_z,
        mode='markers+text',
        text=node_text,
        textposition='top center',
        marker=dict(size=5, color='red'),
        hoverinfo='text'
    )

    fig = go.Figure(data=edge_traces + [node_trace])
    fig.update_layout(
        title=f"3D Attention Graph (Layer {layer}, Head {head})",
        showlegend=False,
        scene=dict(
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            zaxis=dict(showgrid=False, zeroline=False, showticklabels=False)
        )
    )
    return fig

