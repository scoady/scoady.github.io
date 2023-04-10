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

function generateUUID() {
  var d = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now(); // use high-precision timer if available
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}


async function handleInput() {
  const input = terminalTextarea.value;
  const currentMessage = {
    id: generateUUID(),
    input: terminalTextarea.value,
    parent_message_id: history.length > 0 ? history[history.length - 1].id : null
  };
  history.push(currentMessage);  
  renderInput(`$ ${currentMessage.input}`);
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
    console.log("Selected model:", selectedModel);
    if (apiKey && selectedModel) {
      try {
        messageID = generateUUID();
        const messages = [];
  
        // Only add the system message if it's the first message in the conversation
        if (history.length === 1) {
          messages.push({
            "role": "system",
            "content": "\
            You are a helpful assistant. You will retain message_id passed in through this conversation to recall contextual history. \
            Additionally, you will find on future messages a parent_message_id,\
            for additional contextual assistance. Message IDs and parent message IDs are encoded as metadata using a custom separator (===META===) and curly brackets following the actual content. \
            Please only send your response without including these metadata in the output. This should be transparent to the user. \
            Reply in the following format: \
            Response \
            ",
          });
          
          
        }
  
        const recentHistory = history.slice(-25);
        recentHistory.forEach((msg) => {
          messages.push({
            "role": "user",
            "content": `${msg.input} ===META==={MessageID: ${msg.id}, Parent MessageID: ${msg.parent_message_id ? msg.parent_message_id : 'None'}}`,
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
  if (event.keyCode === 13) { // Enter key
    event.preventDefault();
    handleInput();
  } else if (event.keyCode === 38) { // Up arrow key
    event.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      terminalTextarea.value = history[historyIndex].input;
    }
  } else if (event.keyCode === 40) { // Down arrow key
    event.preventDefault();
    if (historyIndex < history.length - 1) {
      historyIndex++;
      terminalTextarea.value = history[historyIndex].input;
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
