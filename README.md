# token3d - LLM Visualization

**token3d** is a web application that combines a ChatGPT-style conversational interface with interactive visualizations of language model internals. Users can experiment with model parameters, view a dynamically generated 3D attention graph, and inspect token-level saliency analysis—all in real time.

## Features

- **Chat Interface:**  
  Engage with an LLM-powered chat interface that uses Nebius Studio's API for generating responses.

- **Parameter Controls:**  
  Adjust generation parameters such as Temperature, Top-p, Top-k, Presence Penalty, and Maximum Tokens using intuitive sliders.

- **3D Attention Visualization:**  
  View a dynamic 3D attention graph that shows how the model attends to tokens in your input. The graph is generated on the fly for each prompt and can be reloaded by clicking on a previous message.

- **Token Saliency Analysis:**  
  For any user prompt, click the toggle button to view a color-coded saliency map that highlights the importance of each token.

- **Interactive UI Elements:**  
  Includes detailed information modals for both the 3D graph and saliency features, along with responsive design that adjusts to different screen sizes.

## File Structure

```
token3d/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── routes.py             # Flask routes and endpoints
│   ├── utils.py              # Utility functions (chat, saliency, attention, 3D graph)
│   ├── templates/
│   │   ├── base.html         # Base layout with modals and UI components
│   │   └── index.html        # Chat interface extending base.html
│   └── static/
│       ├── css/
│       │   └── style.css     # Custom styles and layout
│       └── js/
│           ├── graph.js      # Helper functions for 3D graph rendering
│           └── main.js       # Front-end logic for chat, saliency, and graph caching
├── config.py                 # Configuration settings (e.g., secret key, API keys)
├── requirements.txt          # Project dependencies
└── run.py                    # Entry point to run the Flask application
```

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/varun1352/token3d.git
   cd token3d
   ```

2. **Create a Virtual Environment & Install Dependencies:**

   ```bash
   python3 -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set Up Environment Variables:**

   Create a `.env` file in the project root and add your credentials (e.g., Nebius API key, Flask secret key):

   ```env
   SECRET_KEY=your_secret_key_here
   NEBIUS_API_KEY=your_nebius_api_key_here
   ```

   *(If using python-dotenv, make sure it’s loaded in your application.)*

4. **Run the Application:**

   ```bash
   flask run
   ```

   The app should now be accessible at [http://127.0.0.1:5000](http://127.0.0.1:5000).

## Usage

1. **Chat Interface:**  
   Type your prompt into the chat input field and click "Send". The bot's response will appear below your message.

2. **3D Attention Graph:**  
   Each new prompt generates a dynamic 3D attention graph in the right sidebar. Clicking on a previous user message reloads its associated graph.

3. **Saliency Analysis:**  
   Click the ▼ toggle next to your user message to see token saliency details. This reveals which tokens most influenced the model's decision.

4. **Parameter Controls:**  
   Use the sliders on the left sidebar to adjust model generation parameters. Hover over the info icons for detailed explanations.

## Customization & Development

- **Modifying Visualizations:**  
  - The 3D graph is generated via a combination of NetworkX (for layout) and Plotly (for rendering). Adjust the code in `app/utils.py` (functions `get_attention_map` and `build_3d_attention_figure`) to change the visualization.
  - Saliency is computed using gradient-based methods in the same file (`compute_saliency`).

- **Front-End Logic:**  
  - The JavaScript files (`main.js` and `graph.js`) manage the chat interactions, saliency toggling, and dynamic graph rendering. They include caching mechanisms to avoid re-fetching graphs unnecessarily.

- **Styling:**  
  - Customize `app/static/css/style.css` for further design tweaks. The project uses Bootstrap for basic layout and components.

## Dependencies

- Flask
- Plotly
- NetworkX
- Transformers
- Torch
- OpenAI (Python SDK)
- Bootstrap (via CDN)
- Bootstrap Icons (via CDN)

*(See `requirements.txt` for the full list.)*

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests on [GitHub](https://github.com/varun1352/token3d).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- The project draws inspiration from recent advances in language model interpretability.
- Special thanks to the developers of Transformers, Plotly, and Flask for providing excellent tools to build this project.

---

