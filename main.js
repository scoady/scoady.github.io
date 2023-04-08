const apiKeyInput = document.getElementById('api-key');
const modelDropdown = document.getElementById('models-dropdown');
const modelDropdownButton = document.getElementById('models-dropdown-button');
const modelsList = modelDropdown.querySelector('ul');
const submitButton = document.getElementById('submit');
const outputContainer = document.getElementById('output-container');
const summarizeByInput = document.getElementById('summarize-by');
const summarizeByContainer = document.getElementById('summarize-by-container');
const dataTags = document.getElementsByTagName('data-tags');
let fileContent = ''; // Move this line to the outer scope



async function streamRequest(url, options, onChunk) {
  return new Promise(async (resolve, reject) => {
    const response = await fetch(url, options);

    if (!response.ok) {
      reject(`API request failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const textDecoder = new TextDecoder();

    async function read() {
      const { value, done } = await reader.read();

      if (done) {
        return resolve();
      }

      const chunk = textDecoder.decode(value);
      onChunk(chunk);
      console.log("Processed: " + chunk);
      read();
    }

    read();
  });
}

function clearPreviousResults() {
  while (outputContainer.firstChild) {
    outputContainer.removeChild(outputContainer.firstChild);
  }
}

let jsonBuffer = '';

function processChunk(chunk, jsonBuffer, onText) {
  let localJsonBuffer = jsonBuffer + chunk;
  const jsonRegex = /{[\s\S]*?}\n/g;

  let match;
  while ((match = jsonRegex.exec(localJsonBuffer)) !== null) {
    const jsonString = match[0];
    try {
      console.log("Processing JSON:", jsonString);
      const parsedJson = JSON.parse(jsonString);
      onText(parsedJson.choices[0].text);
      localJsonBuffer = localJsonBuffer.substring(jsonRegex.lastIndex);
    } catch (error) {
      console.error("Error while parsing JSON:", error.message);
      return { isCompleted: false, newJsonBuffer: localJsonBuffer };
    }
  }

  if (localJsonBuffer.includes("data: [DONE]")) {
    return { isCompleted: true, newJsonBuffer: "" };
  } else {
    return { isCompleted: false, newJsonBuffer: localJsonBuffer };
  }
}













async function getModels(apiKey) {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (response.ok) {
    const data = await response.json();
    return data.data;
  } else {
    throw new Error(`Error fetching models: ${response.statusText}`);
  }
}

function createOutputCard(output, rawOutput) {
  console.log("Output: " + output);
  const card = document.createElement("article");
  card.classList.add("output-pane");

  const cardTitle = document.createElement("h3");
  cardTitle.textContent = "Completion Overview";
  card.appendChild(cardTitle);

  const cardBody = document.createElement("div");
  card.appendChild(cardBody);

  cardBody.appendChild(output);
  cardBody.appendChild(rawOutput);

  const clearButton = document.createElement("button");
  clearButton.classList.add("button");
  clearButton.textContent = "Clear";
  clearButton.style.marginTop = "10px";
  clearButton.addEventListener("click", () => {
    outputContainer.removeChild(card);
  });

  cardBody.appendChild(clearButton);

  outputContainer.appendChild(card);
}


function displayResults(result) {
  console.log("Result:", result);
  const formattedOutput = document.createElement("p");
  //formattedOutput.textContent = JSON.stringify(result);
  console.log("result" + JSON.stringify(result) );


  const performanceObject = {
     raw_result: result
  }


  const rawOutputCard = document.createElement("pre");
  rawOutputCard.style.whiteSpace = "pre-wrap";
  //rawOutputCard.textContent = JSON.stringify(performanceObject, null, 2);
  rawOutputCard.textContent = JSON.stringify(performanceObject,null,2)

  createOutputCard(formattedOutput, rawOutputCard);
}




function createSpinner() {
    const spinner = document.createElement("span");
    spinner.classList.add("spinner");
    return spinner;
  }
  
  function showLoadingIndicator(tags) {
    tags.forEach(tag => {
      const card = document.createElement("article");
      card.classList.add("card");
      card.classList.add("loading-card");
  
      const cardHeader = document.createElement("header");
      cardHeader.classList.add("card-header");
      cardHeader.setAttribute("data-tag", tag);
  
      const checkMark = document.createElement("span");
      checkMark.classList.add("checkmark");
      checkMark.innerHTML = "&#10003;";
      checkMark.style.display = "none";
      cardHeader.appendChild(checkMark);
  
      const cardText = document.createElement("p");
      cardText.classList.add("card-title");
      cardText.style.display = "inline";
      cardText.textContent = tag;
      cardHeader.appendChild(cardText);
  
      cardHeader.appendChild(createSpinner());
  
      const cardBody = document.createElement("div");
      cardBody.classList.add("card-body");
  
      const cardTextBody = document.createElement("p");
      cardTextBody.classList.add("card-text");
      cardTextBody.textContent = "Loading...";
  
      cardBody.appendChild(cardTextBody);
      card.appendChild(cardHeader);
      card.appendChild(cardBody);
  
      outputContainer.appendChild(card);
    });
  }
  
  
  
  
  
  function findCardByHeader(tag) {
    const headers = document.querySelectorAll('header.card-header');
    let foundHeader = null;
  
    headers.forEach(header => {
      if (header.getAttribute('data-tag') === tag) {
        foundHeader = header.parentNode;
      }
    });
  
    return foundHeader;
  }
  
  

  function updateLoadingIndicator(tag, isLoading) {
    const cardHeader = findCardByHeader(tag);
    const checkMark = cardHeader.querySelector(".checkmark");
    const spinner = cardHeader.querySelector(".spinner");
  
    if (isLoading) {
      spinner.style.display = "inline-block";
      checkMark.style.display = "none";
    } else {
      spinner.style.display = "none";
      checkMark.style.display = "inline-block";
    }
  }
  
  
  
  
  
  

function getTags() {
    const tags = [];
    const tagElements = document.querySelectorAll('.tag');
  
    tagElements.forEach(tagElement => {
      tags.push(tagElement.textContent.slice(0, -1)); // Remove the 'x' at the end of the tag text
    });
  
    return tags;
  }
  function showSummary(data, tags) {
    console.log('Data:', data, 'Tags:', tags);

    tags.forEach(tag => {
      if (data[tag]) {
        const card = findCardByHeader(tag);
        
        if (!card) {
          console.error("Card not found for tag:", tag);
          return;
        }
        
        const cardBody = card.querySelector(".card-body");
        cardBody.innerHTML = `<p>${data[tag]}</p>`;
        
        updateLoadingIndicator(tag, false);
      }
    });
  }
  

  async function handleSubmit(e) {
    let inputText = '';
    clearPreviousResults();
    const apiKey = document.querySelector("#api-key").value;
    const model = document.querySelector("#models-dropdown").getAttribute("data-selected-model");
    const context = document.querySelector("#context").value;
    const contentInput = document.getElementById("content").value;
    const combinedTags = getTags().join(", ");
    const tags = getTags();
    showLoadingIndicator(tags);
  
    if (contentInput.startsWith("http://") || contentInput.startsWith("https://")) {
      inputText =  context;
    } else if (fileContent) {
      inputText = fileContent;
    } else {
      inputText = contentInput;
    }
  
    if (!model) {
      alert("Please pick a model first.");
      return;
    }
  
    if (!inputText) {
      alert("Please provide content to analyze.");
      return;
    }
  
    const chunkSize = 2048;
    const overlap = 500;
    const inputChunks = [];
  
    for (let i = 0; i < inputText.length; i += chunkSize - overlap) {
      const start = i === 0 ? i : i - overlap;
      const end = Math.min(i + chunkSize, inputText.length);
      inputChunks.push(inputText.slice(start, end));
    }
  
    let finalOutput = "";
    let parsedResults = [];
  
    for (let chunkIndex = 0; chunkIndex < inputChunks.length; chunkIndex++) {
      const chunk = inputChunks[chunkIndex];
      const prompt = `Analyze: ${chunk}, Analysis Context: "${context}", Response format: tag: response  where tags: "${combinedTags}. Provide your answer in JSON with only the requested tag categorization.`;
  
      try {
        const requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            prompt: prompt,
            max_tokens: 100,
            n: 1,
            model: model,
            temperature: 0.8,
            stream: true,
          }),
        };
  
        let jsonBuffer = "";
        let accumulatedText = "";
  
        await streamRequest("https://api.openai.com/v1/completions", requestOptions, (chunk) => {
          const { isCompleted, newJsonBuffer } = processChunk(chunk, jsonBuffer, (textPart) => {
            accumulatedText += textPart;
          });
          jsonBuffer = newJsonBuffer;
  
          if (isCompleted) {
            console.log("Completed processing JSON.");
            if (isValidJSON(accumulatedText)) {
              const parsedResult = JSON.parse(accumulatedText);
              parsedResults.push(parsedResult);
            } else {
              console.log("Invalid JSON:", accumulatedText);
            }
          }
        });
  
        if (chunkIndex > 0) {
          const startIndex = overlap;
          const endIndex = chunk.length;
          finalOutput += accumulatedText.slice(startIndex, endIndex);
        } else {
          finalOutput += accumulatedText;
        }
      } catch (error) {
        console.log('Failed to parse JSON:', jsonString);
        console.error("Error:", error);
        fileContent = "";
      }
    }
  
  // Display the final output and results after processing all chunks
  console.log("Final Output:", finalOutput);
  parsedResults.forEach(parsedResult => {
    displayResults(parsedResult);
    showSummary(parsedResult, tags);
  });
}

function isValidJSON(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
  
  
  

function createTag(text) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = text;
  
    const removeIcon = document.createElement('span');
    removeIcon.className = 'tag-remove';
    removeIcon.textContent = 'x';
    removeIcon.addEventListener('click', () => {
      summarizeByContainer.removeChild(tag);
    });
  
    tag.appendChild(removeIcon);
    summarizeByContainer.insertBefore(tag, summarizeByInput);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // ... Rest of your event listeners ...
  
    const urlInput = document.getElementById("content"); // Assuming "content" is the id of the URL input field
    const fileInput = document.getElementById('file-upload');
    const textInput = document.getElementById("content");




    
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          fileContent = e.target.result;
        };
        reader.readAsText(file);
      }
    });


    modelDropdownButton.addEventListener('click', () => {
      const filterInput = modelDropdown.querySelector("input");
      const filter = filterInput.value.toUpperCase();
      const dropdownContent = modelDropdown.querySelector("ul");
      const options = dropdownContent.getElementsByTagName("li");
      const label = modelDropdown.querySelector("label");
    
      if (filter && filter !== "Select Model") {
        label.style.display = "none";
      } else {
        label.style.display = "block";
      }
    
      for (let i = 0; i < options.length; i++) {
        const optionText = options[i].textContent || options[i].innerText;
        if (optionText.toUpperCase().indexOf(filter) > -1) {
          options[i].style.display = "";
        } else {
          options[i].style.display = "none";
        }
      }
    });
    
    
    
    
    
    
    
    


    apiKeyInput.addEventListener('input', async () => {
        const apiKey = apiKeyInput.value;
    
        if (apiKey) {
          try {
            const models = await getModels(apiKey);
    
            // Clear the models list and repopulate it
            modelsList.innerHTML = '';
    
            models.forEach((model) => {
              const listItem = document.createElement('li');
              const modelLink = document.createElement('a');
              modelLink.textContent = model.id;
              modelLink.href = '#';
              modelLink.addEventListener('click', (event) => {
                event.preventDefault();
                modelDropdown.querySelector('summary').textContent = model.id;
                modelDropdown.setAttribute('data-selected-model', model.id);
                modelDropdown.open = false;
              });
              listItem.appendChild(modelLink);
              modelsList.appendChild(listItem);
            });
          } catch (error) {
            console.error('Error fetching models:', error);
          }
        }
      });
      summarizeByInput.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          const tagText = event.target.value.trim();
          if (tagText) {
            createTag(tagText);
            // Clear the input field after creating a tag
            event.target.value = '';
          }
        }
      });


    submitButton.addEventListener('click', async (e) => {
        e.preventDefault();
        
        submitButton.disabled = false;
        submitButton.textContent = 'Please wait...';
      
        await handleSubmit();
      
        submitButton.textContent = 'Submit';
        submitButton.disabled = false;
      });
      
});
