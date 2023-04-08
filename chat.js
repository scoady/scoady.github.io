const terminalContainer = document.getElementById("terminal-container");
const terminalPrompt = document.getElementById("terminal-prompt");
const terminalTextarea = document.getElementById("terminal-textarea");
const terminalOutput = document.getElementById("terminal-output");
const history = [];
let historyIndex = 0;



async function processStream(reader) {
  let utf8Decoder = new TextDecoder("utf-8");
  let isFirstChunk = true;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      console.log("Stream ended");
      break;
    }

    const chunk = utf8Decoder.decode(value);
    const strippedChunk = chunk.replace(/.*data: /s, '');
    console.log("Stripped chunk: " + strippedChunk);

    if (strippedChunk.includes('[DONE]')) {
      console.log("Stream ended");
      break;
    }

    try {
      const parsedChunk = JSON.parse(strippedChunk);

      if (parsedChunk.choices && parsedChunk.choices[0] && parsedChunk.choices[0].delta) {
        const content = parsedChunk.choices[0].delta.content;
        renderOutput(content, false);
      }
    } catch (error) {
      console.error("Error parsing data frame:", error);
    }
  }
}











function hasSelectedModel() {
  return localStorage.getItem("selectedModel") !== null;
}

// Get the selected model from localStorage
function getSelectedModel() {
  return localStorage.getItem("selectedModel");
}

async function loadNavBar() {
  const response = await fetch('nav.html');
  const navContent = await response.text();
  document.getElementById('nav-container').innerHTML = navContent;
}

function renderPrompt() {
  terminalPrompt.innerHTML = `&gt; `;
  terminalTextarea.value = "";
  terminalTextarea.focus();
}

function renderInput(input) {
  const inputLine = document.createElement("p");
  inputLine.classList.add("terminal-line");
  inputLine.innerHTML = input;
  terminalOutput.appendChild(inputLine);
}

function renderOutput(output, newLine = true) {
  if (newLine) {
    const outputLine = document.createElement("p");
    outputLine.classList.add("terminal-line");

    outputLine.innerHTML = '[<img src="gpt.svg" alt="GPT" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;">' + getSelectedModel() + ']:  ' + output;

    terminalOutput.appendChild(outputLine);
  } else {
    const lastOutputLine = terminalOutput.lastElementChild;
    if (lastOutputLine) {
      lastOutputLine.innerHTML += output;
    } else {
      renderOutput(output);
    }
  }
}
// Check if an API key is already stored in localStorage
function hasApiKey() {
  return localStorage.getItem("apiKey") !== null;
}

// Save the API key in localStorage
function saveApiKey(apiKey) {
  localStorage.setItem("apiKey", apiKey);
}

// Get the API key from localStorage (masked)
function getMaskedApiKey() {
  const apiKey = localStorage.getItem("apiKey");
  return apiKey.slice(0, 4) + "************";
}

// Validate the API key by making a request to the OpenAI API /models endpoint
async function getModels(apiKey) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (response.ok) {
    saveApiKey(apiKey);
    const data = await response.json();
    chatModels = data.data.filter(model =>
      model.id.includes("gpt-")
    );
    console.log("GPT Models: " + chatModels);
    //return data.data; // Return the list of models
    return chatModels;
  } else {
    throw new Error("Invalid API key");
  }
}

async function handleInput() {
  const input = terminalTextarea.value;
  history.push(input);
  renderInput(`$ ${input}`);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;

  if (input === "clear") {
    terminalOutput.innerHTML = "";
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

    renderOutput("",true);
    renderPrompt();
    if (apiKey && selectedModel) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                "role": "system",
                "content": "You are a helpful assistant."
              },
              {
                "role": "user",
                "content": input
              }],
            stream: true,
          }),
        });

        if (response.ok) {
          const reader = response.body.getReader();
          await processStream(reader);
        } else {
          throw new Error("Request failed");
        }
      } catch (error) {
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
  if (event.keyCode === 13) {
    event.preventDefault();
    handleInput();
  } else if (event.keyCode === 38) { // Up arrow key
    event.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      terminalTextarea.value = history[historyIndex];
    }
  } else if (event.keyCode === 40) { // Down arrow key
    event.preventDefault();
    if (historyIndex < history.length - 1) {
      historyIndex++;
      terminalTextarea.value = history[historyIndex];
    } else {
      historyIndex = history.length;
      terminalTextarea.value = "";
    }
  }
}

function init() {
  renderPrompt();
  terminalTextarea.addEventListener("keydown", handleKeydown);
}

init();

document.addEventListener('DOMContentLoaded', async () => {
  loadNavBar();
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
});


// Add an event listener to the window that focuses on the input field whenever a key is pressed
window.addEventListener("keydown", () => {
  const input = document.querySelector("#terminal-textarea");
  input.focus();
});
