const CHAT_URLS = ["https://chatgpt.com/", "https://chat.openai.com/"];

console.log(
  "ChatGPT Screenshot Uploader service worker initialized",
  new Date().toISOString()
);

console.log("Commands API available:", typeof chrome.commands !== "undefined");

chrome.runtime.onStartup.addListener(() => {
  console.log("Extension started up", new Date().toISOString());

  chrome.storage.local.get(["preferredFolderId", "savedFolders"], (result) => {
    if (result.preferredFolderId) {
      console.log(
        `Loaded saved folder preference on startup: ${result.preferredFolderId}`
      );
    } else {
      console.log("No saved folder preference found on startup");
    }

    if (result.savedFolders && result.savedFolders.length > 0) {
      console.log(
        `Loaded ${result.savedFolders.length} saved folders on startup`
      );
    } else {
      console.log("No saved folders found on startup");
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated", new Date().toISOString());

  chrome.storage.local.get(["savedFolders", "preferredFolderId"], (result) => {
    if (!result.savedFolders) {
      chrome.storage.local.set({ savedFolders: [] });
    }
    if (!result.preferredFolderId) {
      chrome.storage.local.set({ preferredFolderId: "main" });
    }
  });
});

async function captureActiveVisibleArea() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!tab || typeof tab.windowId !== "number")
    throw new Error("No active tab");

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  return { dataUrl, sourceTabId: tab.id };
}

async function navigateToChatFolder(tabId, folderId) {
  try {
    let url;
    if (folderId.includes("/project")) {
      url = `https://chatgpt.com/g/${folderId}`;
    } else if (folderId.includes("-deltamath")) {
      url = `https://chatgpt.com/g/${folderId}`;
      console.log(`Using corrected deltamath URL: ${url}`);
    } else {
      url = `https://chatgpt.com/g/${folderId}`;
    }

    console.log(`Navigating to folder URL: ${url}`);

    await chrome.tabs.update(tabId, { url });
    await waitForTabComplete(tabId);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (e) {
    console.error("Failed to navigate to folder:", e);
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const check = async () => {
      try {
        const t = await chrome.tabs.get(tabId);
        if (t.status === "complete") {
          resolve();
          return;
        }
      } catch {
        resolve();
        return;
      }
      setTimeout(check, 150);
    };
    check();
  });
}

async function findOrCreateChatTab(folderId) {
  if (folderId) {
    await chrome.storage.local.set({ preferredFolderId: folderId });
    console.log(`Saved preferred folder: ${folderId}`);
  } else {
    const { preferredFolderId } = await chrome.storage.local.get([
      "preferredFolderId",
    ]);
    if (preferredFolderId) {
      folderId = preferredFolderId;
      console.log(`Using saved preferred folder: ${folderId}`);
    }
  }

  const { chatTabId } = await chrome.storage.local.get(["chatTabId"]);
  if (chatTabId) {
    try {
      const t = await chrome.tabs.get(chatTabId);
      if (t && !t.discarded) {
        if (folderId && folderId !== "main") {
          await navigateToChatFolder(t.id, folderId);
        }
        return t;
      }
    } catch {}
  }

  const candidates = await chrome.tabs.query({
    url: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  });

  if (candidates.length > 0) {
    const ready =
      candidates.find((t) => t.status === "complete") || candidates[0];
    await chrome.storage.local.set({ chatTabId: ready.id });

    if (folderId && folderId !== "main") {
      await navigateToChatFolder(ready.id, folderId);
    }

    return ready;
  }

  let url = "https://chatgpt.com/";
  if (folderId && folderId !== "main") {
    if (folderId.includes("-deltamath")) {
      url = `https://chatgpt.com/g/${folderId}`;
      console.log(`Using corrected deltamath URL: ${url}`);
    } else if (folderId.includes("/project")) {
      url = `https://chatgpt.com/g/${folderId}`;
    } else {
      url = `https://chatgpt.com/g/${folderId}`;
    }
  }

  const newTab = await chrome.tabs.create({ url });
  await chrome.storage.local.set({ chatTabId: newTab.id });

  await waitForTabComplete(newTab.id);
  return await chrome.tabs.get(newTab.id);
}

async function detectChatFolders(tabId) {
  try {
    console.log("Detecting folders in tab:", tabId);

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        function findFolders() {
          console.log("Finding folders in ChatGPT page");

          const folders = [];

          try {
            const selectors = [
              'a[href^="/g/"]',
              '.sidebar a[href*="/g/"]',
              'nav a[href*="/g/"]',
              'aside a[href*="/g/"]',
              '[role="navigation"] a[href*="/g/"]',
              'div[class*="sidebar"] a[href*="/g/"]',
              'a[href*="/g/"]',
            ];

            let folderElements = [];

            for (const selector of selectors) {
              try {
                const elements = document.querySelectorAll(selector);
                if (elements && elements.length > 0) {
                  folderElements = Array.from(elements);
                  console.log(
                    `Found ${elements.length} folders using selector: ${selector}`
                  );
                  break;
                }
              } catch (selectorError) {
                console.error(
                  `Error with selector ${selector}:`,
                  selectorError
                );
              }
            }

            folderElements.forEach((el) => {
              try {
                const href = el.getAttribute("href");
                if (!href) return;

                let id;
                if (href.startsWith("/g/")) {
                  id = href.replace("/g/", "").split("/")[0];
                } else if (href.includes("/g/")) {
                  id = href.replace(/^.*\/g\//, "").split("/")[0];
                }

                let name = el.innerText.trim();
                if (!name) {
                  const textElement = el.querySelector("div, span");
                  if (textElement) {
                    name = textElement.innerText.trim();
                  }
                }

                if (id && name) {
                  if (!folders.some((f) => f.id === id)) {
                    console.log(`Found folder: ${name} (${id})`);
                    folders.push({ id, name });
                  }
                }
              } catch (e) {
                console.error("Error processing folder element:", e);
              }
            });
          } catch (mainError) {
            console.error("Error in main folder detection:", mainError);
          }

          if (folders.length === 0) {
            try {
              console.log("Trying alternative folder detection...");
              const allElements = document.querySelectorAll("a");

              for (const el of allElements) {
                try {
                  const href = el.getAttribute("href");
                  if (!href) continue;

                  if (href.includes("/g/")) {
                    let id = href.replace(/^.*\/g\//, "").split("/")[0];
                    if (!id) continue;

                    let name = el.innerText.trim();
                    if (!name || name.length < 2) {
                      const parent = el.parentElement;
                      if (parent) {
                        const nameEl = parent.querySelector("div, span");
                        if (nameEl) name = nameEl.innerText.trim();
                      }
                    }

                    if (!name || name.length < 2) {
                      name = id.split("-").pop() || id;
                    }

                    if (!folders.some((f) => f.id === id)) {
                      folders.push({ id, name });
                      console.log(`Found possible folder: ${name} (${id})`);
                    }
                  }
                } catch (elementError) {}
              }
            } catch (alternativeError) {
              console.error(
                "Error in alternative folder detection:",
                alternativeError
              );
            }
          }

          console.log(`Total folders found: ${folders.length}`);
          return folders;
        }

        return findFolders();
      },
    });

    if (result && result[0] && result[0].result) {
      const folders = result[0].result;
      console.log("Folder detection result:", folders);

      if (folders && folders.length > 0) {
        await chrome.storage.local.set({
          savedFolders: folders,
          foldersLastUpdated: Date.now(),
        });
        console.log("Saved folders to storage");
      }

      return folders;
    }

    console.log("No folders found");
    return [];
  } catch (e) {
    console.error("Error detecting folders:", e);
    return [];
  }
}

async function injectUploader(tabId, dataUrl) {
  try {
    const pageCheck = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        console.log("[PageCheck] Checking if page is ready for upload");

        const currentUrl = window.location.href;

        const isDeltamath = currentUrl.includes("-deltamath");
        const isProjectPage = currentUrl.includes("/project");

        const fileInputs = document.querySelectorAll('input[type="file"]');

        return {
          url: currentUrl,
          isDeltamath,
          isProjectPage,
          hasFileInputs: fileInputs.length > 0,
          pageTitle: document.title,
        };
      },
    });

    if (pageCheck && pageCheck[0] && pageCheck[0].result) {
      const pageStatus = pageCheck[0].result;
      console.log("Page status before upload:", pageStatus);

      if (pageStatus.isDeltamath && !pageStatus.hasFileInputs) {
        console.log(
          "Deltamath page without file inputs detected, looking for UI elements"
        );

        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const uploadKeywords = [
              "upload",
              "project",
              "attach",
              "file",
              "photo",
              "image",
            ];

            for (const keyword of uploadKeywords) {
              const elements = Array.from(
                document.querySelectorAll('button, a, div[role="button"]')
              ).filter((el) => el.innerText.toLowerCase().includes(keyword));

              if (elements.length > 0) {
                console.log(
                  `Found element with keyword "${keyword}", clicking it:`,
                  elements[0]
                );
                elements[0].click();
                return true;
              }
            }

            return false;
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  } catch (e) {
    console.error("Error during page preparation:", e);
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    func: async (payload) => {
      const dataUrl = payload.dataUrl;

      function dataURLtoBlob(dataurl) {
        const arr = dataurl.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        return new Blob([u8arr], { type: mime });
      }

      function sleep(ms) {
        return new Promise((res) => setTimeout(res, ms));
      }

      function findFileInput() {
        console.log("[Uploader] Looking for file input on page");

        const inputs = Array.from(
          document.querySelectorAll('input[type="file"]')
        );
        console.log(`[Uploader] Found ${inputs.length} file inputs on page`);

        if (inputs.length === 0) {
          const possibleUploadButtons = Array.from(
            document.querySelectorAll('button, span, div[role="button"]')
          ).filter((el) => {
            const text = el.innerText.toLowerCase();
            return (
              text.includes("upload") ||
              text.includes("attach") ||
              text.includes("file") ||
              text.includes("image") ||
              text.includes("photo")
            );
          });

          if (possibleUploadButtons.length > 0) {
            console.log("[Uploader] Found possible upload button, clicking it");
            possibleUploadButtons[0].click();
            return null;
          }
        }

        let imgInputs = inputs.filter((i) =>
          (i.accept || "").toLowerCase().includes("image")
        );
        if (imgInputs.length) {
          console.log("[Uploader] Found image-specific input");
          return imgInputs[0];
        }

        const composerArea = document.querySelector(
          '.chat-composer, .text-input-with-buttons, [data-testid="text-input-with-attachments"]'
        );
        if (composerArea) {
          const composerInputs = inputs.filter((input) => {
            return composerArea.contains(input);
          });

          if (composerInputs.length) {
            console.log("[Uploader] Found input in composer area");
            return composerInputs[0];
          }
        }

        const visibleInputs = inputs.filter((input) => {
          const style = window.getComputedStyle(input);
          const parent = input.parentElement;
          const parentStyle = parent ? window.getComputedStyle(parent) : null;

          return (
            style.display !== "none" ||
            (parentStyle && parentStyle.display !== "none")
          );
        });

        if (visibleInputs.length) {
          console.log("[Uploader] Found visible input");
          return visibleInputs[0];
        }

        if (inputs.length) {
          console.log("[Uploader] Using first available input as fallback");
          return inputs[0];
        }

        console.log("[Uploader] No file input found");
        return null;
      }

      function focusComposer() {
        const textareas = document.querySelectorAll(
          'textarea, [contenteditable="true"]'
        );
        if (textareas.length) {
          const el = textareas[0];
          el.focus();
          console.log("[Uploader] Focused on composer");
        } else {
          console.log("[Uploader] No composer found to focus");
        }
      }

      function clickSend() {
        const selectors = [
          'button[type="submit"]',
          '[data-testid="send-button"]',
          'button:has(svg[aria-label="Send"])',
          'button[aria-label="Send"]',
          "button.send-button",
          "button.primary",
          "button.submit",
        ];

        for (const sel of selectors) {
          const buttons = document.querySelectorAll(sel);
          console.log(
            `[Uploader] Found ${buttons.length} buttons matching ${sel}`
          );

          for (const btn of buttons) {
            if (!btn.disabled) {
              console.log(`[Uploader] Clicking send button: ${sel}`);
              btn.click();
              return true;
            }
          }
        }

        console.log("[Uploader] No send button found or all buttons disabled");
        return false;
      }

      try {
        focusComposer();

        await sleep(500);

        let input = findFileInput();

        if (!input) {
          console.log(
            "[Uploader] No input found on first try, waiting and retrying..."
          );
          await sleep(1500);
          input = findFileInput();
        }

        if (!input) {
          console.log(
            "[Uploader] Still no input found, waiting longer and retrying..."
          );
          await sleep(2000);
          input = findFileInput();
        }

        if (!input) {
          console.warn(
            "[Uploader] No file input found on page after multiple attempts."
          );
          return;
        }

        console.log("[Uploader] File input found, preparing to upload");

        const blob = dataURLtoBlob(dataUrl);
        const file = new File([blob], "screenshot.png", { type: "image/png" });

        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;

        input.dispatchEvent(new Event("change", { bubbles: true }));
        console.log("[Uploader] File attached to input");

        await sleep(800);

        if (!clickSend()) {
          console.log(
            "[Uploader] Send button not ready, waiting and trying again"
          );
          await sleep(1000);
          clickSend();
        }
      } catch (e) {
        console.error("[Uploader] Failed:", e);
      }
    },
    args: [{ dataUrl }],
  });
}

async function handleHotkey(folderId = null) {
  try {
    if (!folderId) {
      const { preferredFolderId } = await chrome.storage.local.get([
        "preferredFolderId",
      ]);
      folderId = preferredFolderId || null;
    } else {
      await chrome.storage.local.set({ preferredFolderId: folderId });
    }

    console.log("handleHotkey called with folder:", folderId);
    const { dataUrl } = await captureActiveVisibleArea();

    const chatTab = await findOrCreateChatTab(folderId);

    if (!chatTab.active) {
      await chrome.tabs.update(chatTab.id, { active: true });
      await chrome.windows.update(chatTab.windowId, { focused: true });
    }

    await new Promise((resolve) => setTimeout(resolve, 800));

    if (folderId && folderId.includes("-deltamath")) {
      console.log("Detecting deltamath interface before upload...");

      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: chatTab.id },
          func: () => {
            console.log("Checking for deltamath interface elements");

            const fileInputs = document.querySelectorAll('input[type="file"]');
            if (fileInputs.length === 0) {
              console.log(
                "No file inputs found, may need to navigate to project page"
              );

              const projectButtons = Array.from(
                document.querySelectorAll("button, a")
              ).filter((el) => {
                const text = el.innerText.toLowerCase();
                return text.includes("project") || text.includes("upload");
              });

              if (projectButtons.length > 0) {
                console.log("Found project button, clicking it");
                projectButtons[0].click();
                return { clickedProjectButton: true };
              }
            } else {
              console.log("Found file inputs, page ready for upload");
              return { pageReady: true };
            }

            return { pageUnknown: true };
          },
        });

        if (result && result[0] && result[0].result) {
          const status = result[0].result;
          console.log("Deltamath page status:", status);

          if (status.clickedProjectButton) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      } catch (e) {
        console.error("Error checking deltamath interface:", e);
      }
    }

    await injectUploader(chatTab.id, dataUrl);
  } catch (e) {
    console.error(e);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  console.log("Command received:", command);
  if (command === "capture-and-upload") {
    const { preferredFolderId } = await chrome.storage.local.get([
      "preferredFolderId",
    ]);
    console.log(
      `Starting screenshot capture and upload to folder: ${
        preferredFolderId || "main"
      }`
    );
    await handleHotkey();
  }
});

chrome.tabs.onRemoved.addListener(async (closedId) => {
  const { chatTabId } = await chrome.storage.local.get(["chatTabId"]);
  if (chatTabId === closedId) {
    await chrome.storage.local.remove("chatTabId");
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);

  if (message.action === "captureAndUpload") {
    handleHotkey(message.destination);
    return true;
  }

  if (message.action === "getFolders") {
    console.log("Received getFolders request");

    (async () => {
      try {
        const { savedFolders, foldersLastUpdated } =
          await chrome.storage.local.get([
            "savedFolders",
            "foldersLastUpdated",
          ]);

        console.log(
          "Retrieved saved folders from storage:",
          savedFolders ? savedFolders.length : 0,
          "folders, last updated:",
          foldersLastUpdated
            ? new Date(foldersLastUpdated).toLocaleString()
            : "never"
        );

        const candidates = await chrome.tabs.query({
          url: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
        });

        if (candidates.length > 0) {
          console.log("Found ChatGPT tabs:", candidates.length);
          const chatTab =
            candidates.find((t) => t.status === "complete") || candidates[0];

          await new Promise((resolve) => setTimeout(resolve, 500));

          try {
            const folders = await detectChatFolders(chatTab.id);
            console.log("Detected folders from active tab:", folders);

            if (folders && folders.length > 0) {
              sendResponse({ folders });
              return;
            } else {
              console.log("No folders detected from active tab");
            }
          } catch (detectionError) {
            console.error(
              "Error detecting folders from active tab:",
              detectionError
            );
          }
        } else {
          console.log("No ChatGPT tabs found");
        }

        if (savedFolders && savedFolders.length > 0) {
          console.log("Using saved folders from storage:", savedFolders);
          sendResponse({ folders: savedFolders, fromStorage: true });
        } else {
          console.log("No saved folders available");
          sendResponse({ folders: [] });
        }
      } catch (error) {
        console.error("Error in getFolders handler:", error);

        try {
          const { savedFolders } = await chrome.storage.local.get([
            "savedFolders",
          ]);
          if (savedFolders && savedFolders.length > 0) {
            console.log("Using saved folders as error fallback:", savedFolders);
            sendResponse({ folders: savedFolders, fromStorage: true });
          } else {
            sendResponse({ folders: [], error: error.message });
          }
        } catch (storageError) {
          console.error("Failed to get saved folders:", storageError);
          sendResponse({ folders: [], error: error.message });
        }
      }
    })();

    return true;
  }

  return true;
});
