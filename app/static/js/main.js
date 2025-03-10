/**
 * main.js - Main application logic for token3d
 */

// Declare bootstrap and Plotly as global variables (assuming they are loaded externally)
const bootstrap = window.bootstrap
const Plotly = window.Plotly

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const chatForm = document.getElementById("chatForm")
  const chatBox = document.getElementById("chat-box")
  const chatInput = document.getElementById("chatInput")
  const paramForm = document.getElementById("paramForm")
  const clearChatBtn = document.getElementById("clear-chat")
  const themeToggleBtn = document.getElementById("theme-toggle")
  const leftResizer = document.getElementById("left-resizer")
  const rightResizer = document.getElementById("right-resizer")
  const controlsPanel = document.getElementById("controls")
  const chatContainer = document.getElementById("chat-container")
  const graphContainer = document.getElementById("graph-container")

  // State
  let messageCount = 0 // Unique ID for messages
  let currentMessageId = null // Currently selected message
  let isProcessing = false // Flag to prevent multiple submissions
  let isDraggingLeft = false // Flag for left resizer
  let isDraggingRight = false // Flag for right resizer
  let startX = 0 // Starting X position for resizing
  let startLeftWidth = 0 // Starting width of left panel
  let startRightWidth = 0 // Starting width of right panel

  // Caches
  const saliencyCache = {} // Cache for saliency data
  const graphCache = {} // Cache for graph data

  // Settings
  const currentSettings = {
    layer: 0,
    head: 0,
    threshold: 0.01,
  }

  // Initialize tooltips if Bootstrap is available
  if (typeof bootstrap !== "undefined") {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    const tooltipList = [...tooltipTriggerList].map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl))
  }

  // Initialize parameter value displays
  updateParamValueDisplays()

  /**
   * Fetch the 3D attention graph for a given user text from the /attention-graph endpoint.
   * On success, store it in graphCache[messageId] and render it immediately.
   */
  function fetchGraphForUserMessage(userText, messageId, context = "") {
    // Mark this message as selected
    selectUserMessage(messageId)

    // Check if we have this graph in cache with current settings
    const cacheKey = `${messageId}_l${currentSettings.layer}_h${currentSettings.head}_t${currentSettings.threshold}`
    if (graphCache[cacheKey]) {
      renderAttentionGraph(graphCache[cacheKey])
      return
    }

    // Otherwise, fetch from the server with current settings
    updateGraphWithSettings(userText, messageId)
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
        graphCache[cacheKey] = figJSON

        // Render the graph
        renderAttentionGraph(figJSON)
      })
      .catch((err) => {
        console.error("Error fetching attention graph:", err)
        document.getElementById("graph3d").innerHTML = '<div class="alert alert-danger">Error loading graph</div>'
      })
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
   * Select a user message and deselect others
   */
  function selectUserMessage(messageId) {
    // Remove selected class from all messages
    document.querySelectorAll(".user-message").forEach((msg) => {
      msg.classList.remove("selected")
    })

    // Add selected class to the clicked message
    const selectedMsg = document.getElementById(`user_msg_${messageId}`)
    if (selectedMsg) {
      selectedMsg.classList.add("selected")
      currentMessageId = messageId
    }
  }

  /**
   * Update the parameter value displays
   */
  function updateParamValueDisplays() {
    document.getElementById("temperature-value").textContent = document.getElementById("temperature").value
    document.getElementById("top_p-value").textContent = document.getElementById("top_p").value
    document.getElementById("top_k-value").textContent = document.getElementById("top_k").value
    document.getElementById("presence_penalty-value").textContent = document.getElementById("presence_penalty").value
    document.getElementById("max_tokens-value").textContent = document.getElementById("max_tokens").value

    // Also update threshold value if it exists
    const thresholdValue = document.getElementById("threshold-value")
    const threshold = document.getElementById("threshold")
    if (thresholdValue && threshold) {
      thresholdValue.textContent = threshold.value
    }
  }

  // Handle chat form submission
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault()

    // Prevent multiple submissions
    if (isProcessing) return

    const userText = chatInput.value.trim()
    if (!userText) return

    // Set processing flag
    isProcessing = true

    // Create a user message bubble
    messageCount++
    const userMessageId = messageCount
    const userMessageDiv = document.createElement("div")
    userMessageDiv.className = "alert alert-secondary chat-message user-message"
    userMessageDiv.id = `user_msg_${userMessageId}`
    userMessageDiv.setAttribute("data-msg-id", userMessageId)
    userMessageDiv.setAttribute("data-user-text", encodeURIComponent(userText))

    // We include a separate saliency button (▼) for that message
    userMessageDiv.innerHTML = `
      <div class="d-flex align-items-start">
        <div class="me-2">
          <i class="bi bi-person-circle text-primary fs-5"></i>
        </div>
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">You</div>
          <div>${userText}</div>
          <button class="toggle-saliency" data-msg-id="${userMessageId}" data-user-text="${encodeURIComponent(userText)}">
            <i class="bi bi-eye"></i> Show Saliency
          </button>
          <div class="saliency-container" id="saliency_${userMessageId}" style="display:none;"></div>
        </div>
      </div>
    `

    chatBox.appendChild(userMessageDiv)
    chatBox.scrollTop = chatBox.scrollHeight

    // Add a typing indicator
    const typingIndicator = document.createElement("div")
    typingIndicator.className = "alert alert-primary chat-message typing-indicator"
    typingIndicator.innerHTML = `
      <div class="d-flex align-items-start">
        <div class="me-2">
          <i class="bi bi-robot text-primary fs-5"></i>
        </div>
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">Bot</div>
          <div class="typing-dots">
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      </div>
    `
    chatBox.appendChild(typingIndicator)
    chatBox.scrollTop = chatBox.scrollHeight

    // Gather generation parameters from the UI
    const temperature = document.getElementById("temperature").value
    const top_p = document.getElementById("top_p").value
    const top_k = document.getElementById("top_k").value
    const presence_penalty = document.getElementById("presence_penalty").value
    const max_tokens = document.getElementById("max_tokens").value

    // Send user prompt to the backend for a chat response
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: userText,
        temperature: temperature,
        top_p: top_p,
        top_k: top_k,
        presence_penalty: presence_penalty,
        max_tokens: max_tokens,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        // Remove typing indicator
        const typingIndicator = document.querySelector(".typing-indicator")
        if (typingIndicator) typingIndicator.remove()

        // Create a bot message bubble
        const botMessageDiv = document.createElement("div")
        botMessageDiv.className = "alert alert-primary chat-message"
        botMessageDiv.innerHTML = `
        <div class="d-flex align-items-start">
          <div class="me-2">
            <i class="bi bi-robot text-primary fs-5"></i>
          </div>
          <div class="flex-grow-1">
            <div class="fw-bold mb-1">Bot</div>
            <div>${data.response.replace(/\n/g, "<br>")}</div>
          </div>
        </div>
      `
        chatBox.appendChild(botMessageDiv)
        chatBox.scrollTop = chatBox.scrollHeight

        // Now automatically fetch & render the graph for this new user message
        fetchGraphForUserMessage(userText, userMessageId)

        // Reset processing flag
        isProcessing = false
      })
      .catch((err) => {
        console.error("Error:", err)

        // Remove typing indicator
        const typingIndicator = document.querySelector(".typing-indicator")
        if (typingIndicator) typingIndicator.remove()

        // Show error message
        const errorDiv = document.createElement("div")
        errorDiv.className = "alert alert-danger chat-message"
        errorDiv.innerHTML = `
        <div class="d-flex align-items-start">
          <div class="me-2">
            <i class="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
          </div>
          <div class="flex-grow-1">
            <div class="fw-bold mb-1">Error</div>
            <div>Failed to get a response. Please try again.</div>
          </div>
        </div>
      `
        chatBox.appendChild(errorDiv)
        chatBox.scrollTop = chatBox.scrollHeight

        // Reset processing flag
        isProcessing = false
      })

    // Clear the input field
    chatInput.value = ""
  })

  /**
   * Master click handler inside chatBox:
   * 1) If user clicks the saliency toggle, compute & show saliency.
   * 2) If user clicks the user message bubble, load the 3D attention graph.
   */
  chatBox.addEventListener("click", (e) => {
    // 1) Saliency toggle
    if (e.target.closest(".toggle-saliency")) {
      e.stopPropagation() // prevent bubble click from also firing
      const toggleBtn = e.target.closest(".toggle-saliency")
      const msgId = toggleBtn.getAttribute("data-msg-id")
      const saliencyContainer = document.getElementById("saliency_" + msgId)
      const userText = decodeURIComponent(toggleBtn.getAttribute("data-user-text"))

      if (saliencyContainer.style.display === "none") {
        saliencyContainer.style.display = "block"
        toggleBtn.innerHTML = '<i class="bi bi-eye-slash"></i> Hide Saliency'

        // Check if we have cached saliency data
        if (saliencyCache[userText]) {
          displaySaliencyData(saliencyCache[userText], saliencyContainer)
        } else {
          saliencyContainer.innerHTML =
            '<div class="d-flex justify-content-center my-2"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Loading...</span></div><span class="ms-2">Calculating saliency...</span></div>'

          // Request saliency from the backend
          fetch("/saliency", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: userText }),
          })
            .then((resp) => resp.json())
            .then((data) => {
              if (data.error) {
                saliencyContainer.innerHTML = `<div class="alert alert-danger my-2">${data.error}</div>`
                return
              }

              // Cache the saliency data
              saliencyCache[userText] = data

              // Display the saliency data
              displaySaliencyData(data, saliencyContainer)
            })
            .catch((err) => {
              saliencyContainer.innerHTML = '<div class="alert alert-danger my-2">Error calculating saliency.</div>'
              console.error(err)
            })
        }
      } else {
        saliencyContainer.style.display = "none"
        toggleBtn.innerHTML = '<i class="bi bi-eye"></i> Show Saliency'
      }
      return
    }

    // 2) User message bubble click => load the cached or new attention graph
    const userMessage = e.target.closest(".user-message")
    if (userMessage) {
      const msgId = userMessage.getAttribute("data-msg-id")
      const userText = decodeURIComponent(userMessage.getAttribute("data-user-text"))

      // Re-render or fetch the graph for that user message
      fetchGraphForUserMessage(userText, msgId)
    }
  })

  /**
   * Display saliency data in the container
   */
  function displaySaliencyData(data, container) {
    let saliencyHTML = '<div class="saliency-visualization my-2">'
    const maxVal = Math.max(...data.saliency)

    data.tokens.forEach((token, idx) => {
      const norm = data.saliency[idx] / maxVal
      const r = 255
      const g = Math.floor(200 * (1 - norm))
      const b = Math.floor(200 * (1 - norm))
      const textColor = g < 150 ? "white" : "black"

      saliencyHTML += `
        <span 
          style="
            background-color: rgb(${r}, ${g}, ${b}); 
            color: ${textColor};
            padding: 3px 5px; 
            margin: 2px; 
            border-radius: 3px; 
            display: inline-block;
          "
          data-bs-toggle="tooltip" 
          title="Saliency: ${data.saliency[idx].toExponential(2)}"
        >
          ${token.replace("Ġ", " ")}
        </span>
      `
    })

    saliencyHTML += "</div>"
    saliencyHTML +=
      '<div class="small text-muted mt-2">Tokens with higher saliency (redder background) have more influence on the model\'s output.</div>'

    container.innerHTML = saliencyHTML

    // Initialize tooltips for the new elements if Bootstrap is available
    if (typeof bootstrap !== "undefined") {
      const newTooltips = container.querySelectorAll('[data-bs-toggle="tooltip"]')
      ;[...newTooltips].forEach((el) => new bootstrap.Tooltip(el))
    }
  }

  // Handle parameter form submission
  paramForm.addEventListener("submit", (e) => {
    e.preventDefault()
    // Just update the displays - actual values are read when sending a message
    updateParamValueDisplays()

    // Show a toast notification
    const toast = document.createElement("div")
    toast.className = "position-fixed bottom-0 end-0 p-3"
    toast.style.zIndex = "9999" // Higher z-index to ensure it's on top
    toast.innerHTML = `
      <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header">
          <i class="bi bi-check-circle-fill text-success me-2"></i>
          <strong class="me-auto">Parameters Updated</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          Your model parameters have been updated and will be applied to the next message.
        </div>
      </div>
    `
    document.body.appendChild(toast)

    // Remove the toast after 3 seconds
    setTimeout(() => {
      toast.remove()
    }, 3000)
  })

  // Handle parameter input changes
  document.querySelectorAll('#paramForm input[type="range"]').forEach((input) => {
    input.addEventListener("input", function () {
      const valueDisplay = document.getElementById(`${this.id}-value`)
      if (valueDisplay) {
        valueDisplay.textContent = this.value
      }
    })
  })

  // Handle clear chat button
  clearChatBtn.addEventListener("click", () => {
    // Show confirmation dialog
    if (confirm("Are you sure you want to clear the chat history?")) {
      // Clear the chat box except for the welcome message
      while (chatBox.firstChild) {
        chatBox.removeChild(chatBox.firstChild)
      }

      // Add back the welcome message
      const welcomeMsg = document.createElement("div")
      welcomeMsg.className = "welcome-message alert alert-info"
      welcomeMsg.innerHTML = `
        <h5><i class="bi bi-info-circle"></i> Welcome to token3d</h5>
        <p>This tool helps you visualize how language models process and attend to text. Type a message to begin.</p>
        <p>Features:</p>
        <ul>
          <li>3D attention visualization</li>
          <li>Token saliency analysis</li>
          <li>Parameter experimentation</li>
        </ul>
      `
      chatBox.appendChild(welcomeMsg)

      // Clear the graph
      clearGraph()

      // Reset message count and caches
      messageCount = 0
      Object.keys(graphCache).forEach((key) => delete graphCache[key])
      Object.keys(saliencyCache).forEach((key) => delete saliencyCache[key])
    }
  })

  // Handle theme toggle
  themeToggleBtn.addEventListener("click", () => {
    const htmlElement = document.documentElement
    const currentTheme = htmlElement.getAttribute("data-bs-theme")
    const newTheme = currentTheme === "dark" ? "light" : "dark"

    // Update the theme
    htmlElement.setAttribute("data-bs-theme", newTheme)

    // Update the button icon
    themeToggleBtn.innerHTML = newTheme === "dark" ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>'

    // If we have a graph, re-render it with the new theme
    if (currentMessageId) {
      const selectedMessage = document.querySelector(".user-message.selected")
      if (selectedMessage) {
        const userText = decodeURIComponent(selectedMessage.getAttribute("data-user-text"))
        updateGraphWithSettings(userText, currentMessageId)
      }
    }
  })

  // Add event listeners for range inputs
  document.querySelectorAll('input[type="range"]').forEach((input) => {
    input.addEventListener("input", function () {
      const valueDisplay = document.getElementById(`${this.id}-value`)
      if (valueDisplay) {
        valueDisplay.textContent = this.value
      }

      // If this is the threshold slider, update the currentSettings
      if (this.id === "threshold") {
        currentSettings.threshold = Number.parseFloat(this.value)

        // If we have a selected message, update the graph
        if (currentMessageId) {
          const selectedMessage = document.querySelector(".user-message.selected")
          if (selectedMessage) {
            const userText = decodeURIComponent(selectedMessage.getAttribute("data-user-text"))
            updateGraphWithSettings(userText, currentMessageId)
          }
        }
      }
    })
  })

  // Add event listeners for layer and head selectors
  document.getElementById("layer-select")?.addEventListener("change", function () {
    currentSettings.layer = Number.parseInt(this.value)

    // If we have a selected message, update the graph
    if (currentMessageId) {
      const selectedMessage = document.querySelector(".user-message.selected")
      if (selectedMessage) {
        const userText = decodeURIComponent(selectedMessage.getAttribute("data-user-text"))
        updateGraphWithSettings(userText, currentMessageId)
      }
    }
  })

  document.getElementById("head-select")?.addEventListener("change", function () {
    currentSettings.head = Number.parseInt(this.value)

    // If we have a selected message, update the graph
    if (currentMessageId) {
      const selectedMessage = document.querySelector(".user-message.selected")
      if (selectedMessage) {
        const userText = decodeURIComponent(selectedMessage.getAttribute("data-user-text"))
        updateGraphWithSettings(userText, currentMessageId)
      }
    }
  })

  // Handle fullscreen button for graph
  document.getElementById("fullscreen-graph")?.addEventListener("click", () => {
    const graphModal = new bootstrap.Modal(document.getElementById("graphModal"))
    graphModal.show()

    // When the modal is shown, copy the current graph to the fullscreen container
    document.getElementById("graphModal").addEventListener(
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

  // Panel resizing functionality
  if (leftResizer) {
    leftResizer.addEventListener("mousedown", (e) => {
      isDraggingLeft = true
      startX = e.clientX
      startLeftWidth = controlsPanel.offsetWidth
      document.body.classList.add("resizing")
      e.preventDefault()
    })
  }

  if (rightResizer) {
    rightResizer.addEventListener("mousedown", (e) => {
      isDraggingRight = true
      startX = e.clientX
      startRightWidth = graphContainer.offsetWidth
      document.body.classList.add("resizing")
      e.preventDefault()
    })
  }

  document.addEventListener("mousemove", (e) => {
    if (isDraggingLeft) {
      const newWidth = startLeftWidth + (e.clientX - startX)
      if (newWidth > 150 && newWidth < window.innerWidth / 3) {
        controlsPanel.style.width = `${newWidth}px`
        controlsPanel.style.flexBasis = `${newWidth}px`
      }
    } else if (isDraggingRight) {
      const newWidth = startRightWidth - (e.clientX - startX)
      if (newWidth > 150 && newWidth < window.innerWidth / 3) {
        graphContainer.style.width = `${newWidth}px`
        graphContainer.style.flexBasis = `${newWidth}px`
      }
    }
  })

  document.addEventListener("mouseup", () => {
    isDraggingLeft = false
    isDraggingRight = false
    document.body.classList.remove("resizing")
  })

  // Initialize layer and head selectors
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
  initializeLayerHeadSelectors()
})

