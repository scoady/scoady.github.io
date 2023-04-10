let history = [];

function takeScreenshot() {
    return new Promise((resolve) => {
      html2canvas(document.querySelector('#generatedHTML')).then(canvas => {
        const thumbnailUrl = canvas.toDataURL();
        console.log(thumbnailUrl); // Debugging statement
        localStorage.setItem('thumbnail', thumbnailUrl);
        resolve(thumbnailUrl);
      });
    });
  }
  
  function addCodeFormattedTextPrompt(messageId, prompt) {
    const promptHistory = document.getElementById('promptHistory');
    const pre = document.createElement('pre');
    pre.textContent = `{messageId: ${messageId}, prompt: ${prompt}}`;
    promptHistory.appendChild(pre);
  }

  
  function appendThumbnail(html, messageId, prompt) {
    const existingThumbnail = document.querySelector(`.thumbnail[data-message-id="${messageId}"]`);
  
    if (existingThumbnail) {
      const existingIframe = existingThumbnail.querySelector("iframe");
      existingIframe.srcdoc = html;
    } else {
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.classList.add('thumbnail');
      thumbnailContainer.dataset.messageId = messageId;
  
      const iframe = document.createElement('iframe');
      iframe.srcdoc = html;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.transform = 'scale(0.2)';
      iframe.style.transform = 'scale(1)';

      const expandButton = document.createElement('button');
      expandButton.textContent = 'Expand';
      expandButton.classList.add('expand-button');
      expandButton.addEventListener('click', () => {
        const modal = document.getElementById('modal');
        modal.style.display = 'block';
        const modalIframe = document.querySelector('#modalContent iframe');
        modalIframe.srcdoc = html;
      });
  
      const downloadButton = document.createElement('button');
      downloadButton.textContent = 'Download HTML';
      downloadButton.classList.add('download-button');
      downloadButton.addEventListener('click', () => {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated-${messageId}.html`;
        a.click();
        URL.revokeObjectURL(url);
      });
  
      thumbnailContainer.appendChild(iframe);
      thumbnailContainer.appendChild(expandButton);
      thumbnailContainer.appendChild(downloadButton);
      document.getElementById('thumbnailContainer').appendChild(thumbnailContainer);
      addCodeFormattedTextPrompt(messageId, prompt);

      // Save the data to localStorage
      const dataToStore = {
        messageId,
        thumbnailUrl: iframe.srcdoc,
        prompt,
        html
      };
      localStorage.setItem(`generatedHTML-${messageId}`, JSON.stringify(dataToStore));
    }
  }
  
  
  
  
  

  document.getElementById('closeIframe').addEventListener('click', () => {
    const iframe = document.querySelector('#modalContent iframe');
    const iframeContent = iframe.contentWindow.document.documentElement.outerHTML;
    const messageId = history[history.length - 1].id;
    const prompt = history[history.length - 1].input;
    appendThumbnail(iframeContent, messageId, prompt);
    document.getElementById('modal').style.display = 'none';
  });
  
  
  

document.getElementById('apiKeySubmit').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKeyInput').value;
  if (apiKey) {
    const models = await fetchModels(apiKey);
    console.log('models', models); // Debugging statement
    if (models) {
      localStorage.setItem('openaiApiKey', apiKey);
      document.getElementById('apiKeySection').style.display = 'none';
      document.getElementById('generatorSection').style.display = 'block';
    } else {
      alert('Invalid API Key');
    }
  } else {
    alert('Please enter an API Key');
  }
});

async function fetchModels(apiKey) {
  const requestOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  };

  const response = await fetch('https://api.openai.com/v1/models', requestOptions);

  if (response.status === 200) {
    const data = await response.json();
    console.log('data', data); // Debugging statement
    return data;
  } else {
    return null;
  }
}

function addPromptToHistory(prompt) {
  const promptHistory = document.getElementById('promptHistory');
  const li = document.createElement('li');
  li.textContent = prompt;
  promptHistory.appendChild(li);
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

async function generateHTML(apiKey, prompt, messageId, callback) {
    const messages = [];
    const currentMessage = {
      id: generateUUID(),
      input: prompt,
      parent_message_id: history.length > 0 ? history[history.length - 1].id : null
    };
    history.push(currentMessage);
    const recentHistory = history.slice(-25);
    if (history.length === 1) {
      messages.push({
        "role": "system",
        "content": "\
              You are a helpful assistant helping to construct HTML content based on the request of the user. \
              You will retain message_id passed in through this conversation to recall contextual history. \
              Additionally, you will find on future messages a parent_message_id,\
              for additional contextual assistance. Message IDs and parent message IDs are encoded as metadata using a custom separator (===META===) and curly brackets following the actual content. \
              Please only send your response without including these metadata in the output. This should be transparent to the user. \
              Reply only with the complete HTML needed to satisfy the request, without any additional commentary. \
              All HTML must include in-line CSS and script content. \
          "
          });
    }
    recentHistory.forEach(msg => {
      messages.push({
        "role": "user",
        "content": `${msg.input} ===META==={MessageID: ${msg.id}, Parent MessageID: ${msg.parent_message_id ? msg.parent_message_id : 'None'}}`,
      });
    })
  
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.8,
        max_tokens: 3000,
        n: 1,
      })
    };
  
    const response = await fetch('https://api.openai.com/v1/chat/completions', requestOptions);
    const data = await response.json();
    const html = data.choices[0].message.content;
    console.log("HTML: " + html); // Debugging statement
  
    if (callback) {
        callback(html);
      }
      const iframe = document.querySelector('#modalContent iframe');
      iframe.srcdoc = html;
      document.getElementById('modal').style.display = 'block';
    
      return html;
  }
  

  document.getElementById('closeIframe').addEventListener('click', () => {
    const iframe = document.querySelector('#modalContent iframe');
    const iframeContent = iframe.contentWindow.document.documentElement.outerHTML;
    const messageId = history[history.length - 1].id;
    const prompt = history[history.length - 1].input;
    appendThumbnail(iframeContent, messageId, prompt);
    document.getElementById('modal').style.display = 'none';
  });
  
          
        
        document.getElementById('downloadHTML').addEventListener('click', () => {
        const iframe = document.querySelector('#modalContent iframe');
        const iframeContent = iframe.contentWindow.document.documentElement.outerHTML;
        const blob = new Blob([iframeContent], {type: 'text/html;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated.html';
        a.click();
        URL.revokeObjectURL(url);
        });
        
        document.getElementById('generateHTML').addEventListener('click', () => {
        const apiKey = localStorage.getItem('openaiApiKey');
        const prompt = document.getElementById('promptInput').value;
        if (apiKey && prompt) {
            generateHTML(apiKey, prompt, history.length, (html) => {
            const iframe = document.querySelector('#modalContent iframe');
            iframe.srcdoc = html;
            document.getElementById('modal').style.display = 'block';
            });
        } else {
            alert('Please enter an API Key and a prompt');
        }
        });


        document.getElementById('toggleHistory').addEventListener('click', () => {
        const promptHistory = document.getElementById('promptHistory');
        if (promptHistory.style.display === 'none') {
        promptHistory.style.display = 'block';
        } else {
        promptHistory.style.display = 'none';
        }
        });
        
        function addPromptToHistory(prompt) {
        const promptHistory = document.getElementById('promptHistory');
        const li = document.createElement('li');
        li.textContent = prompt;
        promptHistory.appendChild(li);
        }
        
        async function summarizePromptHistory(apiKey) {
            const promptHistory = document.getElementById('promptHistory');
            const prompts = Array.from(promptHistory.querySelectorAll('li')).map(li => li.textContent).join('\n');
            return await generateHTML(apiKey, `Generate a summary of the following prompts:\n${prompts}`);
        }
        document.getElementById('summarizePrompt').addEventListener('click', async () => {
            const apiKey = localStorage.getItem('openaiApiKey');
            if (apiKey) {
                const summary = await summarizePromptHistory(apiKey);
                alert(`Suggested summary prompt: ${summary}`);
            } else {
                alert('Please enter an API Key');
            }
        });
        
        async function init() {
            // Check if the API key is in local storage and display the generator section if it is.
            const storedApiKey = localStorage.getItem('openaiApiKey');
            if (storedApiKey) {
                const models = await fetchModels(storedApiKey);
                if (models) {
                    document.getElementById('apiKeySection').style.display = 'none';
                    document.getElementById('generatorSection').style.display = 'block';
                } else {
                    localStorage.removeItem('openaiApiKey');
                }
            }
        }
        
        init();
                