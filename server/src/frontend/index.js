"use strict";

const shareBtn = document.getElementById("share-button");
const noteTitle = document.getElementById("note-title");
const noteContent = document.getElementById("note-content");
const genPassphraseBox = document.getElementById("passphrase-gen");
const fileUpload = document.getElementById("file-upload");
const uploadContainer = document.getElementById("upload-container");
const attachmentContainer = document.getElementById("attachment-container");
const attachmentLink = document.getElementById("attachment-link");
const shortenToggle = document.getElementById("shorten-toggle");
const shortenContainer = document.getElementById("shorten-container");
const passphraseContainer = document.getElementById("passphrase-container");

// why these don't just use static methods I have no idea
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function compressBytesToBase64(...bytes) {
    // combine byte arrays into a single stream for compression
    const stream = new Blob(bytes).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));

    // obtain compressed data from stream
    const chunks = [];
    for await (const chunk of compressedStream) {
      chunks.push(chunk);
    }
    const buf = await new Blob(chunks).arrayBuffer();

    // convert byte array buffer back to a bytestring
    const str = new Uint8Array(buf).reduce((acc, cur) => acc + String.fromCodePoint(cur), "");

    // convert bytestring to base64
    return btoa(str);
}

async function extractBase64(base64Str) {
    // convert base64 -> bytes
    const raw = atob(base64Str);
    const bytes = Array.from(raw, char => char.codePointAt(0));

    // decompress data using streams
    const stream = new Blob([new Uint8Array(bytes)]).stream();
    const decompressStream = stream.pipeThrough(new DecompressionStream("gzip"));

    const chunks = [];
        for await (const chunk of decompressStream) {
        chunks.push(chunk);
    }
    const buf = await new Blob(chunks).arrayBuffer();

    // split resulting monolithic bytestring into components
    const salt = new Uint8Array(buf.slice(0, 16));
    const iv = new Uint8Array(buf.slice(16, 16 + 12));
    const ct = new Uint8Array(buf.slice(16 + 12));

    return [salt, iv, ct];
}

async function passwordToKey(salt, password, encryption = true) {
    // import password string as CryptoKey object
    const passwordKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);

    // key derivation parameters (derivation algorithm & how key will be used)
    const pbkdf2Params = {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 200000,
    };
    const aesKeyParams = {
      name: "AES-GCM",
      length: 256
    };
    const purpose = encryption ? "encrypt" : "decrypt";

    // actually derive key
    return await crypto.subtle.deriveKey(pbkdf2Params, passwordKey, aesKeyParams, false, [purpose]);
}

async function shareNote() {
  if (noteTitle.value === "" || noteContent.textContent === "") {
    alert("Make sure you enter both a title and some content before sharing!");
  } else {
    // upload attachment if present
    let fileId = "";
    const attachmentList = fileUpload.files;
    if (attachmentList.length > 0) {
        const reqData = new FormData();
        reqData.append("file", attachmentList[0]);
        
        const uploadResp = await fetch("/attachments/upload", {
            method: "POST",
            body: reqData
        });

        fileId = await uploadResp.text();
    }
      
    // place note content into stringified JSON object
    const noteData = {
      title: noteTitle.value,
      // innerHTML is used to preserve formatting
      // a CSP policy is enforced by the server to mitigate XSS
      body: noteContent.innerHTML
    };

    if (fileId !== "") {
        noteData.fileId = fileId;
    }
    
    const dataStr = JSON.stringify(noteData);

    let password = "";
    let generatePassword = genPassphraseBox.checked;

    if (generatePassword) {
        // get memorable passphrase from dedicated microservice
        const passphraseResp = await fetch("/passphrase");
        password = await passphraseResp.text();
    } else {
        // prompt for password, enforcing a minimum length
         password = prompt("Enter a secure password for your note (8+ characters):");
        while (password === null || password.length < 8) {
          password = prompt("Invalid password, please try again.");
        }
    }

    // generate random key derivation salt & encryption IV
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    // generate key & encrypt note contents
    const key = await passwordToKey(salt, password);
    const ct = await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode("fragment-encrypted-notes")
    }, key, encoder.encode(dataStr));

    // write resulting URL to clipboard
    const result = await compressBytesToBase64(salt, iv, ct);
    let noteURL = `${location.origin}/note#${result}`;

    if (shortenToggle.checked) {
        const shortenResp = await fetch("/shorten", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: noteURL
            })
        });
        noteURL = await shortenResp.text();
    }
    
    navigator.clipboard.writeText(noteURL);

    let alertMsg = "Note URL copied to your clipboard! You can paste it elsewhere to share it with other people.\n\nYour note is protected by secure encryption, so only the people you share your password with can read it. Make sure to remember your password though, since if you forget it you will lose your note contents forever!";

    if (generatePassword) {
        alertMsg += `\n\nYour autogenerated passphrase is: ${password}`;
    }

    const authenticated = window.sessionStorage.getItem("authenticated");
    if (authenticated) {
        alertMsg += "\n\nYour note was also added to your account; you can view your account's notes by navigating to the main fragment server link with /list at the end.";

        // add message to user storage
        await fetch("/auth/entries", {
            method: "POST",
            body: noteURL
        });
    }

    alert(alertMsg);
  }
}

async function tryLoadNote() {
    // recover parameters from URL hash (i.e., stuff after #)
    const b64 = location.hash.slice(1);
    const [salt, iv, ct] = await extractBase64(b64);

    // rederive key
    const password = prompt("Enter password to decrypt note:");
    const key = await passwordToKey(salt, password, false);

    // decrypt note contents
    const buf = await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv,
        additionalData: encoder.encode("fragment-encrypted-notes")
    }, key, ct);

    // extract note contents from decrypted ciphertext
    const contentStr = decoder.decode(buf);
    const contents = JSON.parse(contentStr);

    // render note contents onto webpage
    noteTitle.value = contents.title;
    noteContent.innerHTML = contents.body;

    // also attempt to recover attachment, if present
    if (Object.hasOwn(contents, "fileId")) {
        const fileId = contents.fileId;
        attachmentLink.href = `${window.location.origin}/attachments/${fileId}`;
        attachmentContainer.style.display = "block";

        uploadContainer.style.display = "none";
    }

    // also hide share button/passphrase tickbox
    passphraseContainer.style.display = "none";
    shareBtn.style.display = "none";
    uploadContainer.style.display = "none";
    shortenContainer.style.display = "none";
}

function handleFormatKey(ev) {
    if (ev.ctrlKey && !ev.repeat) {
        if (ev.key === "b") {
            // bold
            formatSelection("strong");
            ev.preventDefault();
        } else if (ev.key === "i") {
            // italicize
            formatSelection("em");
            ev.preventDefault();
        } else if (ev.key === "u") {
            // underline
            formatSelection("span", "underlined")
            ev.preventDefault();
        }
    }
}

function formatSelection(formatTag, formatClass = "") {
    const selection = document.getSelection();

    // TODO: toggle vs unconditionally format
    // TODO: handle cross-node cases
    // TODO: focus === anchor necessary?
    if (selection.rangeCount === 1 && selection.focusNode === selection.anchorNode) {
        const formatEl = document.createElement(formatTag);

        // allow for extra formatting
        if (formatClass !== "") {
            formatEl.classList.add(formatClass);
        }

        formatEl.textContent = selection.toString();

        // extract text on either side
        const focusOff = selection.focusOffset;
        const anchorOff = selection.anchorOffset;

        const begin = Math.min(focusOff, anchorOff);
        const end = Math.max(focusOff, anchorOff);

        const oldContent = selection.focusNode.textContent;
        const beforeText = document.createTextNode(oldContent.slice(0, begin));
        const afterText = document.createTextNode(oldContent.slice(end));

        // do text replacement (why is there no insertAfter??)
        const parent = selection.focusNode.parentNode;
        parent.replaceChild(afterText, selection.focusNode);
        parent.insertBefore(formatEl, afterText);
        parent.insertBefore(beforeText, formatEl);

        // move cursor back to where it was
        if (begin === focusOff) {
            // focus was at the beginning of the selection
            selection.setPosition(beforeText, focusOff);
        } else {
            // focus was at end of selection
            selection.setPosition(afterText);
        }
    }
}

addEventListener("DOMContentLoaded", ev => {
    const loggedIn = window.sessionStorage.getItem("authenticated");

    // hide login header if logged in
    if (loggedIn) {
        const loginHeader = document.getElementById("login-header");
        loginHeader.style.display = "none";

        // also display list header
        const listHeader = document.getElementById("list-header");
        listHeader.style.display = "block";
    }
    
    shareBtn.addEventListener("click", ev => shareNote());

    // attempt to load note from hash
    if (location.hash !== "") {
        tryLoadNote().catch(err => alert("Oops, something went wrong when loading your note. Please make sure you have the right password & link and reload the page to try again."));
    }

    noteContent.addEventListener("keydown", handleFormatKey);
});
