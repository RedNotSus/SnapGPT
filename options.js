document.addEventListener('DOMContentLoaded', () => {
  const saveStatus = document.getElementById('save-status');
  const providerRadios = document.querySelectorAll('input[name="ai-provider"]');

  // Load the saved setting and update the UI
  chrome.storage.local.get('aiProvider', (result) => {
    const savedProvider = result.aiProvider || 'chatgpt'; // Default to chatgpt
    const radioToCheck = document.querySelector(`input[value="${savedProvider}"]`);
    if (radioToCheck) {
      radioToCheck.checked = true;
    }
  });

  // Save the setting when a radio button is clicked
  providerRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const selectedProvider = document.querySelector('input[name="ai-provider"]:checked').value;
      chrome.storage.local.set({ aiProvider: selectedProvider }, () => {
        saveStatus.textContent = 'Settings saved.';
        setTimeout(() => {
          saveStatus.textContent = '';
        }, 2000);
      });
    });
  });
});
