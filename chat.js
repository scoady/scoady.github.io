const history = [];
let historyIndex = 0;
let currentStreamReader = null; // Store the current stream reader to allow canceling


document.addEventListener('DOMContentLoaded', async () => {
  if (hasApiKey()) {
    try {
      const models = await getModels(localStorage.getItem("apiKey"));
      if (models) {
        showModal(models);
      }
    } catch (error) {
      console.log(error);
    }
  }

  // Initialize terminal functionality
  renderPrompt();
  const inputField = document.getElementById("terminal-input-field");
  inputField.addEventListener("keydown", handleKeydown);
  inputField.focus();

  // Keep the input field focused
  inputField.addEventListener("blur", () => {
    setTimeout(() => inputField.focus(), 0);
  });
});

async function processStream(reader) {
  let utf8Decoder = new TextDecoder("utf-8");
  let accumulatedChunk = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      console.log("Stream ended");
      break;
    }

    const chunk = utf8Decoder.decode(value);
    accumulatedChunk += chunk;

    const chunkLines = accumulatedChunk.split("\n");
    accumulatedChunk = chunkLines.pop(); // Keep any incomplete line for next iteration

    chunkLines.forEach(line => {
      if (line.startsWith("data: ")) {
        const strippedChunk = line.replace("data: ", "").trim();

        if (strippedChunk === "[DONE]") {
          console.log("Stream ended");
          return;
        }

        try {
          const parsedChunk = JSON.parse(strippedChunk);
          console.log("Parsed chunk:", parsedChunk);

          if (parsedChunk.choices && parsedChunk.choices[0] && parsedChunk.choices[0].delta) {
            const content = parsedChunk.choices[0].delta.content;
            if (content) {
              renderOutput(content.replace(/ ===META===.*/, ""), false); // Strip metadata before rendering
            }
          }
        } catch (error) {
          console.error("Error parsing data frame:", error);
        }
      }
    });
  }
}

function renderOutput(content, isInput = false) {
  const outputDiv = document.getElementById("terminal-output");
  if (isInput) {
    const inputElement = document.createElement("div");
    inputElement.textContent = content;
    inputElement.classList.add("terminal-input");
    outputDiv.appendChild(inputElement);
  } else {
    if (outputDiv.lastChild && outputDiv.lastChild.classList.contains("terminal-input")) {
      const outputElement = document.createElement("div");
      outputElement.textContent = content;
      outputDiv.appendChild(outputElement);
    } else {
      if (outputDiv.lastChild) {
        outputDiv.lastChild.textContent += content;
      } else {
        const outputElement = document.createElement("div");
        outputElement.textContent = content;
        outputDiv.appendChild(outputElement);
      }
    }
  }
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

function renderPrompt() {
  const prompt = document.getElementById("terminal-prompt");
  prompt.innerHTML = "$";
}

// Function to handle API key existence
function hasApiKey() {
  return !!localStorage.getItem("apiKey");
}

// Generate a UUID for message IDs
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function handleInput() {
  const terminalInputField = document.getElementById("terminal-input-field");
  const terminalOutput = document.getElementById("terminal-output");

  const input = terminalInputField.value.trim();
  terminalInputField.value = '';  // Clear the input field
  const currentMessage = {
    id: generateUUID(),
    input: input,
    parent_message_id: history.length > 0 ? history[history.length - 1].id : null
  };
  history.push(currentMessage);
  renderOutput(`$ ${currentMessage.input}`, true);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;

  if (input === "clear") {
    terminalOutput.innerHTML = "";
  } else if (input === "\u0003") { // Handle 'Ctrl+C' input to stop stream
    if (currentStreamReader) {
      currentStreamReader.cancel();
      renderOutput("^C", true);
    }
  } else if (input.startsWith("apikey ")) {
    const apiKey = input.replace("apikey ", "").trim();

    try {
      const models = await getModels(apiKey);
      if (models) {
        localStorage.setItem("apiKey", apiKey);
        showModal(models);
      } else {
        renderOutput("[ GPT ] Invalid API key. Please provide a valid API key.");
      }
    } catch (error) {
      renderOutput("[ GPT ] Invalid API key. Please provide a valid API key.");
    }
  } else {
    const apiKey = localStorage.getItem("apiKey");
    const selectedModel = getSelectedModel();

    renderOutput("", true);
    renderPrompt();
    console.log("Selected model:", selectedModel);
    if (apiKey && selectedModel) {
      try {
        const messageID = generateUUID();
        const messages = [];

        // Add the system message with the terminal prompt if it's the first message in the conversation
        if (history.length === 1) {
          messages.push({
            "role": "system",
            "content": "You are a Linux terminal running on Ubuntu. Respond to all inputs exactly as a real Ubuntu terminal would. Do not include any chat-like responses or explanations. Only output the exact terminal commands' results or errors. For any unknown command, respond with 'command not found'. Always keep the format and style consistent with a real Ubuntu terminal. Ignore any metadata in the format ===META===."
          });
        }

        const recentHistory = history.slice(-25);
        recentHistory.forEach((msg) => {
          messages.push({
            "role": "user",
            "content": `${msg.input}\n===META==={MessageID: ${msg.id}, Parent MessageID: ${msg.parent_message_id ? msg.parent_message_id : 'None'}}\nYou are a Linux terminal running on Ubuntu. Respond to all inputs exactly as a real Ubuntu terminal would. Do not include any chat-like responses or explanations. Only output the exact terminal commands' results or errors. For any unknown command, respond with 'command not found'. Always keep the format and style consistent with a real Ubuntu terminal. Ensure the formatting and output match exactly as it would appear in a Linux terminal. Ignore any metadata in the format ===META===.`
          });
        });

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: messages,
            stream: true // Enable streaming
          }),
        });

        if (response.ok) {
          currentStreamReader = response.body.getReader();
          await processStream(currentStreamReader);
        } else {
          throw new Error("Request failed");
        }
      } catch (error) {
        console.log(error);
        renderOutput("[ GPT ] There was an error processing your request. Please try again.");
      }
    } else if (apiKey) {
      const maskedApiKey = apiKey.slice(0, 4) + "****" + apiKey.slice(-4);
      renderOutput(`You said: ${input} (API key: ${maskedApiKey})`);
    } else {
      renderOutput("Please provide an API key by typing 'apikey <your-api-key>'.");
    }
  }
  renderPrompt();
}

function handleKeydown(event) {
  const terminalInputField = document.getElementById("terminal-input-field");

  if (event.keyCode === 13) { // Enter key
    event.preventDefault();
    handleInput();
  } else if (event.keyCode === 38) { // Up arrow key
    event.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      terminalInputField.value = history[historyIndex].input;
    }
  } else if (event.keyCode === 40) { // Down arrow key
    event.preventDefault();
    if (historyIndex < history.length - 1) {
      historyIndex++;
      terminalInputField.value = history[historyIndex].input;
    } else {
      historyIndex = history.length;
      terminalInputField.value = "";
    }
  }
}

function getModels(apiKey) {
  return fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })
  .then(response => response.json())
  .then(data => data.data);
}

function getSelectedModel() {
  return 'gpt-4-0613'; // Example default model
}

function showModal(models) {
  console.log('Available models:', models);
}