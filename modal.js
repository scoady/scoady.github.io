function createModal() {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>Select a model</h2>
        <ul id="model-list"></ul>
      </div>
    `;
  
    document.body.appendChild(modal);
    return modal;
  }
  
  const modal = createModal();
  const close = modal.querySelector(".close");
  
  function closeModal() {
    modal.style.display = "none";
  }
  
  function initModal() {
    const modal = createModal();
    document.body.appendChild(modal); // Make sure to append the modal to the document body
  
    const close = document.querySelector(".close");
    close.onclick = closeModal;
  
    window.onclick = event => {
      if (event.target === modal) closeModal();
    };
  }

  function showModal(models) {
    initModal();
  
    const modelList = document.getElementById("model-list");
  
    models.forEach(model => {
      const li = document.createElement("li");
      li.textContent = model.id;
      li.addEventListener("click", () => {
        localStorage.setItem("selectedModel", model.id);
        closeModal();
        renderOutput(`Selected model: ${model.id}`);
      });
      modelList.appendChild(li);
    });
  
    const modal = document.querySelector(".modal");
    modal.style.display = "block";
  }
  

  initModal();