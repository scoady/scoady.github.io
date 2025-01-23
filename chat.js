async function handleInput() {
  const terminalInputField = document.getElementById("terminal-input-field");
  const terminalOutput = document.getElementById("terminal-output");

  const input = terminalInputField.value.trim();
  terminalInputField.value = ''; // Clear the input field
  const currentMessage = {
    id: generateUUID(),
    input: input,
    parent_message_id: history.length > 0 ? history[history.length - 1].id : null,
  };
  history.push(currentMessage);
  renderOutput(`$ ${currentMessage.input}`, true);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;

  // Initialize tracing
  const { trace, context } = window.GrafanaFaroWebSdk.api.getOTEL();
  const tracer = trace.getTracer('default');
  const span = tracer.startSpan('userInput', {
    attributes: {
      'user.input': input,
      'user.input.id': currentMessage.id,
    },
  });

  if (input === "clear") {
    terminalOutput.innerHTML = "";
    span.end(); // End the span for 'clear' command
  } else if (input === "\u0003") { // Handle 'Ctrl+C' input to stop stream
    if (currentStreamReader) {
      currentStreamReader.cancel();
      renderOutput("^C", true);
      span.addEvent('stream.canceled', { reason: 'User pressed Ctrl+C' });
      span.end(); // End the span when the stream is canceled
    }
  } else if (input.startsWith("apikey ")) {
    const apiKey = input.replace("apikey ", "").trim();

    try {
      const models = await getModels(apiKey);
      if (models) {
        localStorage.setItem("apiKey", apiKey);
        showModal(models);
        renderOutput("[ GPT ] API key validated. Available models loaded.");
      } else {
        renderOutput("[ GPT ] Invalid API key. Please provide a valid API key.");
      }
      span.setAttribute('apikey.valid', !!models);
      span.end(); // End the span after validating the API key
    } catch (error) {
      renderOutput("[ GPT ] Invalid API key. Please provide a valid API key.");
      span.setAttribute('apikey.valid', false);
      span.end(); // End the span in case of an error
    }
  } else {
    const apiKey = localStorage.getItem("apiKey");
    if (!apiKey) {
      renderOutput("Please provide an API key by typing 'apikey <your-api-key>'.");
      span.setAttribute('apikey.missing', true);
      span.end(); // End the span if API key is missing
      return;
    }

    const selectedModel = getSelectedModel();
    if (!selectedModel) {
      renderOutput("[ GPT ] No model selected. Please select a valid model.");
      span.setAttribute('model.selected', false);
      span.end(); // End the span if no model is selected
      return;
    }

    try {
      const messageID = generateUUID();
      const messages = [];

      // Add the system prompt if it's the first message
      if (history.length === 1) {
        messages.push({
          role: "system",
          content: "You are a Linux terminal running on Ubuntu. Respond to all inputs exactly as a real Ubuntu terminal would...",
        });
      }

      // Add recent history
      const recentHistory = history.slice(-25);
      recentHistory.forEach((msg) => {
        messages.push({
          role: "user",
          content: `${msg.input}\n===META==={MessageID: ${msg.id}, Parent MessageID: ${msg.parent_message_id || 'None'}}\nYou are a Linux terminal running on Ubuntu...`,
        });
      });

      const requestTokenCount = JSON.stringify(messages).split(/\s+/).length; // Approximate token count
      span.setAttribute('user.input.token.count', requestTokenCount);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: messages,
          stream: true, // Enable streaming
        }),
      });

      if (response.ok) {
        currentStreamReader = response.body.getReader();
        let utf8Decoder = new TextDecoder("utf-8");
        let accumulatedResponse = "";
        let tokenCountResponse = 0;

        // Process the response stream
        while (true) {
          const { done, value } = await currentStreamReader.read();
          if (done) {
            break;
          }

          const chunk = utf8Decoder.decode(value);
          accumulatedResponse += chunk;
          tokenCountResponse += chunk.split(/\s+/).length; // Approximate token count
        }

        // Add the response as an event
        span.addEvent('response.received', {
          'response.content': accumulatedResponse,
          'response.token.count': tokenCountResponse,
        });

        // Finalize span with attributes
        span.setAttributes({
          'response.token.count': tokenCountResponse,
          'response.success': true,
        });
        span.end(); // End the span
      } else {
        span.setAttribute('response.success', false);
        throw new Error("Request failed");
      }
    } catch (error) {
      console.error(error);
      renderOutput("[ GPT ] There was an error processing your request. Please try again.");
      span.addEvent('response.error', { error: error.message });
      span.end(); // End the span in case of an error
    }
  }

  renderPrompt();
}
