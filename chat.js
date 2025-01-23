async function handleInput() {
  try {
    const terminalInputField = document.getElementById("terminal-input-field");
    const terminalOutput = document.getElementById("terminal-output");

    const input = terminalInputField.value.trim();
    terminalInputField.value = ''; // Clear the input field
    if (!input) return; // Do nothing for empty input

    const currentMessage = {
      id: generateUUID(),
      input: input,
      parent_message_id: history.length > 0 ? history[history.length - 1].id : null,
    };
    history.push(currentMessage);
    renderOutput(`$ ${currentMessage.input}`, true);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;

    // Tracing (mock or actual SDK logic)
    const { trace } = window.GrafanaFaroWebSdk.api.getOTEL();
    const tracer = trace.getTracer('default');
    const span = tracer.startSpan('userInput', {
      attributes: {
        'user.input': input,
        'user.input.id': currentMessage.id,
      },
    });

    if (input === "clear") {
      terminalOutput.innerHTML = "";
      span.end(); // End span
    } else if (input === "\u0003") { // Handle 'Ctrl+C' input to stop stream
      if (currentStreamReader) {
        currentStreamReader.cancel();
        renderOutput("^C", true);
        span.addEvent('stream.canceled', { reason: 'User pressed Ctrl+C' });
        span.end(); // End span
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
        span.end();
      } catch (error) {
        console.error("Error validating API key:", error);
        renderOutput("[ GPT ] Invalid API key. Please provide a valid API key.");
        span.setAttribute('apikey.valid', false);
        span.end();
      }
    } else {
      const apiKey = localStorage.getItem("apiKey");
      if (!apiKey) {
        renderOutput("Please provide an API key by typing 'apikey <your-api-key>'.");
        span.setAttribute('apikey.missing', true);
        span.end();
        return;
      }

      const selectedModel = getSelectedModel();
      if (!selectedModel) {
        renderOutput("[ GPT ] No model selected. Please select a valid model.");
        span.setAttribute('model.selected', false);
        span.end();
        return;
      }

      try {
        const messages = [];
        if (history.length === 1) {
          messages.push({
            role: "system",
            content: "You are a Linux terminal running on Ubuntu...",
          });
        }

        const recentHistory = history.slice(-25);
        recentHistory.forEach((msg) => {
          messages.push({
            role: "user",
            content: `${msg.input}\n===META==={MessageID: ${msg.id}, Parent MessageID: ${msg.parent_message_id || 'None'}}\nYou are a Linux terminal running on Ubuntu...`,
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
          currentStreamReader = response.body.getReader();
          let utf8Decoder = new TextDecoder("utf-8");
          let accumulatedResponse = "";

          while (true) {
            const { done, value } = await currentStreamReader.read();
            if (done) break;

            const chunk = utf8Decoder.decode(value);
            accumulatedResponse += chunk;
          }

          renderOutput(accumulatedResponse);
          span.addEvent('response.received', { content: accumulatedResponse });
          span.setAttribute('response.success', true);
          span.end();
        } else {
          span.setAttribute('response.success', false);
          throw new Error("Request failed");
        }
      } catch (error) {
        console.error("Error processing input:", error);
        renderOutput("[ GPT ] There was an error processing your request.");
        span.addEvent('response.error', { error: error.message });
        span.end();
      }
    }

    renderPrompt();
  } catch (error) {
    console.error("Error in handleInput:", error);
    renderOutput("[ GPT ] An unexpected error occurred.");
  }
}
