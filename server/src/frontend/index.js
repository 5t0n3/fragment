const noteTitle = document.getElementById("note-title");
const noteContent = document.getElementById("note-content");

async function shareNote() {
  if (noteTitle.value === "" || noteContent.textContent === "") {
    alert("Make sure you enter both a title and some content before sharing!");
  } else {
    // get title/content & shove into JSON obj
    const noteData = {
      title: noteTitle.value,
      // innerHTML is used to preserve formatting
      // a CSP policy is enforced by the server to mitigate XSS
      body: noteContent.innerHTML
    };

    // convert JSON obj to string
    const dataStr = JSON.stringify(noteData);

    // prompt for password (min length?)
    let password = prompt("Enter a secure password for your note (8+ characters):");

    while (password === null || password.length < 8) {
      password = prompt("Invalid password, please try again.");
    }

    const encoder = new TextEncoder();

    // encrypt JSON obj
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    // keygen
    const passwordKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
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
    const key = await crypto.subtle.deriveKey(pbkdf2Params, passwordKey, aesKeyParams, false, ["encrypt"]);

    const ct = await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode("fragment-encrypted-notes")
    }, key, encoder.encode(dataStr));

    const stream = new Blob([salt, iv, ct]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));

    // let resultRaw = "";
    const chunks = [];
    for await (const chunk of compressedStream) {
      chunks.push(chunk);
      // resultRaw += Array.from(chunk, String.fromCodePoint).join("");
    }

    const buf = await new Blob(chunks).arrayBuffer();
    const str = new Uint8Array(buf).reduce((acc, cur) => acc + String.fromCodePoint(cur), "");

    // copy url to clipboard: domain.example/note#encb64
    const resultBase64 = btoa(str);
    navigator.clipboard.writeText(`${location.origin}/note#${resultBase64}`);

    alert("Note URL copied to your clipboard! You can paste it elsewhere to share it with other people.");
  }
}

async function tryLoadNote() {
  const b64 = location.hash.slice(1);
  const raw = atob(b64);

  // decompress
  const bytes = Array.from(raw, char => char.codePointAt(0));
  const stream = new Blob([new Uint8Array(bytes)]).stream();
  const decompressStream = stream.pipeThrough(new DecompressionStream("gzip"));

  const chunks = [];
  for await (const chunk of decompressStream) {
    chunks.push(chunk);
  }

  const buf = await new Blob(chunks).arrayBuffer();
  const salt = new Uint8Array(buf.slice(0, 16));
  const iv = new Uint8Array(buf.slice(16, 16 + 12));
  const ct = new Uint8Array(buf.slice(16 + 12));

  const password = prompt("Enter password to decrypt note:");

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
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
  const key = await crypto.subtle.deriveKey(pbkdf2Params, passwordKey, aesKeyParams, false, ["decrypt"]);

  const contentStr = await crypto.subtle.decrypt({
    name: "AES-GCM",
    iv,
    additionalData: encoder.encode("fragment-encrypted-notes")
  }, key, ct);

  const decoder = new TextDecoder();
  console.log(contentStr);
  const contents = JSON.parse(decoder.decode(contentStr));

  noteTitle.value = contents.title;
  noteContent.innerHTML = contents.body;
}

addEventListener("DOMContentLoaded", ev => {
  const shareBtn = document.getElementById("share-button");
  shareBtn.addEventListener("click", ev => shareNote());

  // attempt to load note from hash
  if (location.hash !== "") {
    tryLoadNote().catch(err => {
      //alert("Unable to load note")
      console.error(err);
    });
  }
  
});
// TODO: load ondomcontentloaded
