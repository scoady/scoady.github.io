const apiKeyInput = document.getElementById('api-key');
const modelDropdown = document.getElementById('models-dropdown');
const modelDropdownButton = document.getElementById('models-dropdown-button');
const modelsList = modelDropdown.querySelector('ul');
const submitButton = document.getElementById('submit');
const outputContainer = document.getElementById('output-container');
const summarizeByInput = document.getElementById('summarize-by');
const summarizeByContainer = document.getElementById('summarize-by-container');
const dataTags = document.getElementsByTagName('data-tags');

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
  
      const cardText = document.createElement("p");
      cardText.classList.add("card-title");
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
      if (header.querySelector('p.card-text').textContent.trim() === tag) {
        console.log("Found matching header: " + header);
        foundHeader = header;
      }
    });
  
    return foundHeader;
  }
  
  

  function updateLoadingIndicator(tag, isLoading) {
    const tagHeader = outputContainer.querySelector(`header.card-header[data-tag="${tag}"]`);
    if (tagHeader) {
      const cardHeaderText = tagHeader.querySelector('.card-header > p.card-text');
      if (isLoading) {
        cardHeaderText.innerHTML = "Loading...";
      } else {
        const checkMark = document.createElement("span");
        checkMark.classList.add("checkmark");
        checkMark.innerHTML = "&#10003;";
        checkMark.style.color = "green";
        checkMark.style.animation = "checkmark-animation 1s";
        tagHeader.replaceChild(checkMark, tagHeader.querySelector(".spinner"));
      }
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
  function showSummary(summary, tags) {
    const outputContainer = document.querySelector("#output-container");
    outputContainer.innerHTML = "";
  
    for (const tag in summary) {
      const card = document.createElement("article");
      card.className = "card";
  
      const cardHeader = document.createElement("header");
      cardHeader.className = "card-header";
      const tagText = document.createTextNode(tag);
      cardHeader.appendChild(tagText);
      const checkMark = document.createElement("span");
      checkMark.classList.add("checkmark");
      checkMark.innerHTML = "&#10003;";
      checkMark.style.display = "none";
      cardHeader.appendChild(checkMark);
      card.appendChild(cardHeader);
  
      const cardBody = document.createElement("div");
      cardBody.className = "card__body";
      cardBody.textContent = summary[tag];
      card.appendChild(cardBody);
  
      const cardFooter = document.createElement("footer");
      cardFooter.className = "card__footer";
      card.appendChild(cardFooter);
  
      outputContainer.appendChild(card);
    }
  
    tags.forEach(tag => {
      updateLoadingIndicator(tag, false);
      const tagHeader = findCardByHeader(tag);
      const checkMark = tagHeader.querySelector(".checkmark");
      checkMark.style.display = "inline-block";
    });
  }
  
  
  
  
  

  async function handleSubmit(e) {
  
    const apiKey = document.querySelector("#api-key").value;
    const model = document.querySelector("#models-dropdown").getAttribute("data-selected-model");
    const context = document.querySelector("#context").value;
    const content = document.querySelector("#content").value;
    const combinedTags = getTags().join(", ");
    const tags = getTags();
    showLoadingIndicator(tags);

    if (!model) {
      alert("Please pick a model first.");
      return;
    }
  
    const prompt = `Content To Analyze: "${content}", Analysis Context: "${context}", Response format: tag: response  where tags: "${combinedTags}. Provide your answer in JSON with only the requested tag categorization.`;
  
  
    try {
      const response = await fetch(`https://api.openai.com/v1/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          prompt: prompt,
          max_tokens: 100,
          n: 1,
          model: model,
          temperature: 0.8,
        })
      });
  
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
  
      const data = await response.json();
      const summary = JSON.parse(data.choices[0].text);
      getTags().forEach(tag => {
        updateLoadingIndicator(tag, false);
      });
  
      showSummary(summary, tags); // Pass tags as an argument
    } catch (error) {
      console.error("Error:", error);
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
  
    modelDropdownButton.addEventListener("input", (event) => {
        const filter = event.target.value.toUpperCase();
        const dropdownContent = modelDropdown.querySelector(".dropdown-content");
        const options = dropdownContent.getElementsByTagName("a");
      
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
    summarizeByInput.addEventListener('input', (event) => {
    if (event.data === ',') {
        const tagText = event.target.value.slice(0, -1).trim();
        if (tagText) {
        createTag(tagText);
        // Clear the input field after creating a tag
        event.target.value = '';
        }
    }
    });


    submitButton.addEventListener('click', async (e) => {
        e.preventDefault();
        
        submitButton.disabled = true;
        submitButton.textContent = 'Please wait...';
      
        await handleSubmit();
      
        submitButton.textContent = 'Submit';
        submitButton.disabled = false;
      });
      
});
