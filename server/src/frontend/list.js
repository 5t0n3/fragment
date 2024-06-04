"use strict";

const listContainer = document.getElementById("list-container");

addEventListener("DOMContentLoaded", ev => {
    const authenticated = window.sessionStorage.getItem("authenticated");
    if (!authenticated) {
        listContainer.textContent = "you're not logged in! make sure to do that ";

        const loginLink = document.createElement("a");
        loginLink.href = window.location.origin + "/account";
        loginLink.textContent = "here.";

        listContainer.appendChild(loginLink);
    } else {
        fetch("/auth/entries").then(resp => resp.json()).then(entryList => {
            if (entryList.length === 0) {
                listContainer.textContent = "no notes yet!";
            } else {
                listContainer.textContent = "Here are your notes:";

                for (const [index, entry] of entryList.entries()) {
                    const entryPara = document.createElement("p");

                    const entryLink = document.createElement("a");
                    entryLink.textContent = `Note #${index + 1}`;
                    entryLink.href = entry;

                    entryPara.appendChild(entryLink);
                    listContainer.appendChild(entryPara);
                }
            }
        });
    }
});
