const noteTitle = document.getElementById("note-title");
const noteContent = document.getElementById("note-content");

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
    // place note content into stringified JSON object
    const noteData = {
      title: noteTitle.value,
      // innerHTML is used to preserve formatting
      // a CSP policy is enforced by the server to mitigate XSS
      body: noteContent.innerHTML
    };
    const dataStr = JSON.stringify(noteData);

    // prompt for password, enforcing a minimum length
    let password = prompt("Enter a secure password for your note (8+ characters):");
    while (password === null || password.length < 8) {
      password = prompt("Invalid password, please try again.");
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
    navigator.clipboard.writeText(`${location.origin}/note#${result}`);

    alert("Note URL copied to your clipboard! You can paste it elsewhere to share it with other people.");
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
}

addEventListener("DOMContentLoaded", ev => {
    const shareBtn = document.getElementById("share-button");
    shareBtn.addEventListener("click", ev => shareNote());

    // attempt to load note from hash
    if (location.hash !== "") {
        tryLoadNote().catch(err => alert("Oops, something went wrong when loading your note. Please make sure you have the right password & link and reload the page to try again."));
    }
});

// https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
// https://w3collective.com/keyboard-shortcuts-javascript/
