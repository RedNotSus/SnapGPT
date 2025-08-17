document.addEventListener("DOMContentLoaded", function () {
  const captureButton = document.getElementById("capture-button");
  const shortcutKey = document.getElementById("shortcut-key");
  const refreshShortcut = document.getElementById("refresh-shortcut");
  const optionsLink = document.getElementById("options-link");
  const folderSelect = document.getElementById("destination-select");
  const folderSelectionDiv = document.getElementById("folder-selection");
  const refreshFoldersButton = document.getElementById("refresh-folders");
  const folderInfoText = document.getElementById("folder-info");
  const savedIndicator = document.getElementById("saved-indicator");

  function updateShortcutDisplay() {
    chrome.commands.getAll(function (commands) {
      const captureCommand = commands.find(
        (cmd) => cmd.name === "capture-and-upload"
      );
      if (captureCommand && captureCommand.shortcut) {
        shortcutKey.textContent = captureCommand.shortcut;
      } else {
        shortcutKey.textContent = "Not set";
      }
    });
  }

  updateShortcutDisplay();

  async function checkChatGPTTabAndFetchFolders() {
    try {
      const { savedFolders, preferredFolderId } = await new Promise(
        (resolve) => {
          chrome.storage.local.get(
            ["savedFolders", "preferredFolderId"],
            (result) => {
              resolve(result);
            }
          );
        }
      );

      if (savedFolders && savedFolders.length > 0) {
        console.log("Initially displaying saved folders:", savedFolders.length);
        updateFolderSelectUI(savedFolders, true);

        if (preferredFolderId) {
          const exists = Array.from(folderSelect.options).some(
            (opt) => opt.value === preferredFolderId
          );

          if (exists) {
            folderSelect.value = preferredFolderId;
            const selectedOption =
              folderSelect.options[folderSelect.selectedIndex];
            folderInfoText.textContent = `Upload to ${selectedOption.text}`;
          }
        }
      } else {
        folderSelectionDiv.style.display = "block";
        folderInfoText.style.display = "block";
        folderInfoText.textContent = "Checking for folders...";
      }

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.log("Folder detection timed out");
          resolve({ folders: savedFolders || [], fromStorage: true });
        }, 5000);
      });

      const messagePromise = new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getFolders" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            resolve({ folders: savedFolders || [], fromStorage: true });
            return;
          }

          console.log("Got folders response:", response);
          resolve(response || { folders: [] });
        });
      });

      const response = await Promise.race([messagePromise, timeoutPromise]);

      if (!response.fromStorage || !savedFolders || savedFolders.length === 0) {
        updateFolderSelectUI(response.folders || [], response.fromStorage);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);

      chrome.storage.local.get(["savedFolders"], (result) => {
        if (result.savedFolders && result.savedFolders.length > 0) {
          console.log("Using saved folders as fallback:", result.savedFolders);
          updateFolderSelectUI(result.savedFolders, true);
        } else {
          updateFolderSelectUI([]);
        }
      });
    }
  }

  function updateFolderSelectUI(folders, fromStorage = false) {
    console.log(
      "Updating folder UI with:",
      folders ? folders.length : 0,
      "folders",
      fromStorage ? "(from storage)" : ""
    );

    folderSelect.innerHTML = '<option value="main">Main Chat</option>';

    folderSelectionDiv.style.display = "block";

    if (folders && folders.length > 0) {
      folderInfoText.style.display = "block";
      folderInfoText.textContent = fromStorage
        ? "Using saved folders. Click refresh to update."
        : "Upload to selected folder in ChatGPT.";

      folders.forEach((folder) => {
        try {
          if (!folder.id || !folder.name) return;

          const option = document.createElement("option");
          option.value = folder.id;
          option.textContent = folder.name;
          folderSelect.appendChild(option);
        } catch (e) {
          console.error("Error adding folder option:", e);
        }
      });

      chrome.storage.local.get(["preferredFolderId"], (result) => {
        if (result.preferredFolderId) {
          try {
            const exists = Array.from(folderSelect.options).some(
              (opt) => opt.value === result.preferredFolderId
            );

            if (exists) {
              folderSelect.value = result.preferredFolderId;

              savedIndicator.style.display = "inline";
              savedIndicator.textContent = "✓ Using saved folder preference";

              const selectedOption =
                folderSelect.options[folderSelect.selectedIndex];
              folderInfoText.textContent = `Upload to ${selectedOption.text}`;
            } else {
              console.log(
                `Saved folder ${result.preferredFolderId} not found in current folder list`
              );
            }
          } catch (e) {
            console.error("Error setting preferred folder:", e);
          }
        }
      });
    } else {
      folderInfoText.style.display = "block";
      folderInfoText.textContent =
        "No folders detected. Use refresh button to load folders.";
    }
  }

  checkChatGPTTabAndFetchFolders();

  refreshFoldersButton.addEventListener("click", function () {
    folderSelect.innerHTML =
      '<option value="main">Main Chat</option><option value="loading">Refreshing...</option>';
    folderSelect.value = "loading";
    folderInfoText.style.display = "block";
    folderInfoText.textContent = "Opening ChatGPT to refresh folders...";

    chrome.tabs.query(
      {
        url: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      },
      (tabs) => {
        if (tabs && tabs.length > 0) {
          const tab = tabs[0];
          chrome.tabs.update(tab.id, { active: true }, () => {
            setTimeout(() => {
              chrome.runtime.sendMessage(
                { action: "getFolders" },
                (response) => {
                  if (
                    response &&
                    response.folders &&
                    response.folders.length > 0
                  ) {
                    updateFolderSelectUI(
                      response.folders,
                      response.fromStorage
                    );

                    savedIndicator.style.display = "inline";
                    savedIndicator.textContent =
                      "✓ Folders refreshed successfully";
                    savedIndicator.style.opacity = "1";
                  } else {
                    folderInfoText.textContent =
                      "No folders found. Try refreshing again.";
                  }
                }
              );
            }, 1000);
          });
        } else {
          chrome.tabs.create(
            { url: "https://chatgpt.com/", active: true },
            (tab) => {
              const checkForFolders = () => {
                chrome.runtime.sendMessage(
                  { action: "getFolders" },
                  (response) => {
                    if (
                      response &&
                      response.folders &&
                      response.folders.length > 0
                    ) {
                      updateFolderSelectUI(
                        response.folders,
                        response.fromStorage
                      );

                      savedIndicator.style.display = "inline";
                      savedIndicator.textContent =
                        "✓ Folders refreshed. You can close the ChatGPT tab.";
                      savedIndicator.style.opacity = "1";
                    } else {
                      folderInfoText.textContent = "Still detecting folders...";
                      setTimeout(checkForFolders, 2000);
                    }
                  }
                );
              };

              setTimeout(() => {
                folderInfoText.textContent = "Detecting folders...";
                checkForFolders();
              }, 3000);
            }
          );
        }
      }
    );
  });

  folderSelect.addEventListener("change", function () {
    if (folderSelect.value !== "loading") {
      chrome.storage.local.set({ preferredFolderId: folderSelect.value });

      savedIndicator.style.display = "inline";
      savedIndicator.textContent = "✓ Selection saved for future uploads";

      folderInfoText.textContent = `Upload to ${
        folderSelect.options[folderSelect.selectedIndex].text
      }`;
      folderInfoText.style.display = "block";

      savedIndicator.style.transition = "opacity 0.3s";
      savedIndicator.style.opacity = "1";
      setTimeout(() => {
        savedIndicator.style.opacity = "0.7";
      }, 1500);
    }
  });

  captureButton.addEventListener("click", function () {
    const selectedFolder = folderSelect.value;

    chrome.storage.local.set(
      {
        preferredFolderId: selectedFolder,
        lastUsedTimestamp: Date.now(),
      },
      () => {
        console.log(`Saved preferred folder: ${selectedFolder}`);

        chrome.runtime.sendMessage({
          action: "captureAndUpload",
          destination: selectedFolder,
        });

        window.close();
      }
    );
  });

  refreshShortcut.addEventListener("click", function (e) {
    e.preventDefault();
    updateShortcutDisplay();
  });

  optionsLink.addEventListener("click", function (e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
