/*
 * graph.js
 *
 * Contains helper functions to render or clear a 3D attention graph in the 'graph3d' div.
 * This is used by main.js to display Plotly figures returned from your Flask backend.
 */

/**
 * graph.js - Handles 3D attention graph visualization
 */

// Declare Plotly
const Plotly = window.Plotly

// Declare graphCache
const graphCache = {}

// Current visualization settings
const currentSettings = {
  layer: 0,
  head: 0,
  threshold: 0.01,
}

/**
 * Render a Plotly figure (in JSON form) into the 'graph3d' div.
 * @param {Object} figJSON - The Plotly figure object, with keys "data" and "layout".
 */
function renderAttentionGraph(figJSON) {
  // Parse the JSON if it's a string
  const graphContainer = document.getElementById("graph3d")
  graphContainer.innerHTML = ""
  const figData = typeof figJSON === "string" ? JSON.parse(figJSON) : figJSON

  // Apply custom styling to the figure
  if (figData.layout) {
    // Check if dark mode is active
    const isDarkMode = document.documentElement.getAttribute("data-bs-theme") === "dark"

    // Update layout for better appearance
    figData.layout = {
      ...figData.layout,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 0, t: 30, b: 0 },
      scene: {
        ...figData.layout.scene,
        xaxis: {
          showgrid: false,
          zeroline: false,
          showticklabels: false,
          title: "",
          backgroundcolor: "rgba(0,0,0,0)",
        },
        yaxis: {
          showgrid: false,
          zeroline: false,
          showticklabels: false,
          title: "",
          backgroundcolor: "rgba(0,0,0,0)",
        },
        zaxis: {
          showgrid: false,
          zeroline: false,
          showticklabels: false,
          title: "",
          backgroundcolor: "rgba(0,0,0,0)",
        },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 },
        },
        aspectmode: "cube",
      },
      title: {
        text: `Attention Map (Layer ${currentSettings.layer}, Head ${currentSettings.head})`,
        font: {
          family: "Arial, sans-serif",
          size: 16,
          color: isDarkMode ? "#e0e0e0" : "#212529",
        },
      },
    }
  }

  // Render in both the main and fullscreen containers
  Plotly.newPlot("graph3d", figData.data, figData.layout, {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ["toImage", "sendDataToCloud"],
  })

  // Also update the fullscreen version if the modal is open
  if (document.getElementById("graphModal").classList.contains("show")) {
    Plotly.newPlot("graph3d-fullscreen", figData.data, figData.layout, {
      responsive: true,
      displayModeBar: true,
    })
  }
}

/**
 * Clear any existing Plotly figure from the 'graph3d' div.
 */
function clearGraph() {
  Plotly.purge("graph3d")
  Plotly.purge("graph3d-fullscreen")
}

/**
 * Update the 3D graph with new settings (layer, head, threshold)
 * @param {string} userText - The user message text
 * @param {string} messageId - The message ID
 */
function updateGraphWithSettings(userText, messageId) {
  // Get the current settings
  const layer = currentSettings.layer
  const head = currentSettings.head
  const threshold = currentSettings.threshold

  // Show loading indicator
  document.getElementById("graph3d").innerHTML =
    '<div class="d-flex justify-content-center align-items-center h-100"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>'

  // Fetch the graph data with the new settings
  fetch("/attention-graph", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: userText,
      layer: layer,
      head: head,
      threshold: threshold,
    }),
  })
    .then((response) => response.json())
    .then((figJSON) => {
      // Store in the cache with the settings as part of the key
      const cacheKey = `${messageId}_l${layer}_h${head}_t${threshold}`
      graphCache[messageId] = figJSON

      // Render the graph
      renderAttentionGraph(figJSON)
    })
    .catch((err) => {
      console.error("Error fetching attention graph:", err)
      document.getElementById("graph3d").innerHTML = '<div class="alert alert-danger">Error loading graph</div>'
    })
}

/**
 * Initialize the layer and head selectors based on model information
 */
function initializeLayerHeadSelectors() {
  fetch("/layer-head-info")
    .then((response) => response.json())
    .then((data) => {
      const layerSelect = document.getElementById("layer-select")
      const headSelect = document.getElementById("head-select")

      // Clear existing options
      layerSelect.innerHTML = ""
      headSelect.innerHTML = ""

      // Add layer options
      for (let i = 0; i < data.layers; i++) {
        const option = document.createElement("option")
        option.value = i
        option.textContent = `Layer ${i}`
        layerSelect.appendChild(option)
      }

      // Add head options
      for (let i = 0; i < data.heads; i++) {
        const option = document.createElement("option")
        option.value = i
        option.textContent = `Head ${i}`
        headSelect.appendChild(option)
      }
    })
    .catch((err) => {
      console.error("Error fetching layer/head info:", err)
      // Fallback to some default values
      const layerSelect = document.getElementById("layer-select")
      const headSelect = document.getElementById("head-select")

      for (let i = 0; i < 12; i++) {
        const layerOption = document.createElement("option")
        layerOption.value = i
        layerOption.textContent = `Layer ${i}`
        layerSelect.appendChild(layerOption)

        const headOption = document.createElement("option")
        headOption.value = i
        headOption.textContent = `Head ${i}`
        headSelect.appendChild(headOption)
      }
    })
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  // Initialize layer and head selectors
  initializeLayerHeadSelectors()

  // Set up event listeners for the visualization controls
  const layerSelect = document.getElementById("layer-select")
  const headSelect = document.getElementById("head-select")
  const thresholdInput = document.getElementById("threshold")
  const thresholdValue = document.getElementById("threshold-value")

  // Update threshold value display
  thresholdInput.addEventListener("input", function () {
    thresholdValue.textContent = this.value
    currentSettings.threshold = Number.parseFloat(this.value)

    // If we have a selected message, update the graph
    const selectedMessage = document.querySelector(".user-message.selected")
    if (selectedMessage) {
      const msgId = selectedMessage.getAttribute("data-msg-id")
      const userText = decodeURIComponent(selectedMessage.getAttribute("data-user-text"))
      updateGraphWithSettings(userText, msgId)
    }
  })

  // Handle layer selection change
  layerSelect.addEventListener("change", function () {
    currentSettings.layer = Number.parseInt(this.value)

    // If we have a selected message, update the graph
    const selectedMessage = document.querySelector(".user-message.selected")
    if (selectedMessage) {
      const msgId = selectedMessage.getAttribute("data-msg-id")
      const userText = decodeURIComponent(selectedMessage.getAttribute("data-user-text"))
      updateGraphWithSettings(userText, msgId)
    }
  })

  // Handle head selection change
  headSelect.addEventListener("change", function () {
    currentSettings.head = Number.parseInt(this.value)

    // If we have a selected message, update the graph
    const selectedMessage = document.querySelector(".user-message.selected")
    if (selectedMessage) {
      const msgId = selectedMessage.getAttribute("data-msg-id")
      const userText = decodeURIComponent(selectedMessage.getAttribute("data-user-text"))
      updateGraphWithSettings(userText, msgId)
    }
  })

  // Handle fullscreen button
  document.getElementById("fullscreen-graph").addEventListener("click", () => {
    // Initialize the bootstrap modal
    const graphModalElement = document.getElementById("graphModal")
    const graphModal = new bootstrap.Modal(graphModalElement)
    graphModal.show()

    // When the modal is shown, copy the current graph to the fullscreen container
    graphModalElement.addEventListener(
      "shown.bs.modal",
      () => {
        const graphData = document.getElementById("graph3d").data
        if (graphData && graphData.length > 0) {
          const currentFig = {
            data: graphData,
            layout: document.getElementById("graph3d").layout,
          }
          Plotly.newPlot("graph3d-fullscreen", currentFig.data, currentFig.layout, {
            responsive: true,
            displayModeBar: true,
          })
        }
      },
      { once: true },
    )
  })
})

