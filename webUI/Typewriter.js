/***********************************************************************
* retro-g15/webUI Typewriter.js
************************************************************************
* Copyright (c) 2022, Paul Kimpel.
* Licensed under the MIT License, see
*       http://www.opensource.org/licenses/mit-license.php
************************************************************************
* Bendix G-15 typewriter device.
*
* Defines the typewriter keyboard and printer device.
*
************************************************************************
* 2022-03-24  P.Kimpel
*   Original version, from retro-g15 PhotoTapePunch.js and ControlPanel.js.
***********************************************************************/

export {Typewriter};

import * as Util from "../emulator/Util.js";
import * as IOCodes from "../emulator/IOCodes.js";
import {openPopup} from "./PopupUtil.js";

class Typewriter {

    static cursorChar = "_";            // end-of-line cursor indicator
    static maxScrollLines = 10000;      // max lines retained in "paper" area
    static maxCols = 132;               // maximum number of columns per line
    static printCodes = [
        " ", "-", "\n", "\t", "$", "!", ".", "~", " ", "-", "\n", "\t", "$", "!", ".", "~",
        "0", "1",  "2",  "3", "4", "5", "6", "7", "8", "9",  "u",  "v", "w", "x", "y", "z"];

    constructor(context) {
        /* Initializes and wires up events for the console typewriter device.
        "context" is an object passing other objects and callback functions from
        the global script:
            $$() returns an object reference from its id value
            processor is the Processor object
            window is the ControlPanel window
        */
        let $$ = this.$$ = context.$$;
        this.processor = context.processor;
        this.window = context.window;
        this.doc = this.window.document;
        this.platen = this.$$("TypewriterPaper");
        this.paperDoc = this.platen.contentDocument;
        this.paperDoc.title = this.doc.title + " Paper";
        this.paper = this.paperDoc.getElementById("Paper");
        this.tabStop = [6,11,16,21,26,31,36,41,46,51,56,61,66,71,76,81,86,
                        91,96,101,106,111,116,121,126,131];

        this.boundMenuClick = this.menuClick.bind(this);
        this.boundPanelKeydown = this.panelKeydown.bind(this);
        this.boundPanelKeyup = this.panelKeyup.bind(this);

        this.clear();

        $$("FrontPanel").addEventListener("keydown", this.boundPanelKeydown, false);
        $$("FrontPanel").addEventListener("keyup", this.boundPanelKeyup, false);
        this.paperDoc.addEventListener("keydown", this.boundPanelKeydown, false);
        this.paperDoc.addEventListener("keyup", this.boundPanelKeyup, false);
        $$("TypewriterMenuIcon").addEventListener("click", this.boundMenuClick, false);

    }

    /**************************************/
    clear() {
        /* Initializes (and if necessary, creates) the typewriter unit state */

        this.ready = true;              // typewriter is ready for output
        this.printerLine = 0;
        this.printerCol = 0;

        this.setPaperEmpty();
    }

    /**************************************/
    cancel() {
        /* Cancels any TypeIn I/O currently in process */

        this.processor.cancelTypeIn();
    }


    /*******************************************************************
    *  Typewriter Input                                                *
    *******************************************************************/

    /**************************************/
    panelKeydown(ev) {
        /* Handles the keydown event from FrontPanel. Processes data input from
        the keyboard, Enable switch command codes, and Escape (for toggling the
        Enable switch) */
        let code = ev.key.charCodeAt(0) & 0x7F;
        let key = ev.key;
        let p = this.processor;         // local copy of Processor reference

        if (ev.ctrlKey || ev.altKey || ev.metaKey) {
            return;                     // ignore this keystroke, allow default action
        }

        switch (key) {
        case "-": case "/":
        case "0": case "1": case "2": case "3": case "4":
        case "5": case "6": case "7": case "8": case "9":
        case "S": case "s":
        case "U": case "V": case "W": case "X": case "Y": case "Z":
        case "u": case "v": case "w": case "x": case "y": case "z":
            ev.preventDefault();
            ev.stopPropagation();
            this.printChar(key);
            p.receiveKeyboardCode(IOCodes.ioCodeFilter[code]);
            break;
        case "A": case "a":
        case "B": case "b":
        case "C": case "c":
        case "F": case "f":
        case "I": case "i":
        case "M": case "m":
        case "P": case "p":
        case "Q": case "q":
        case "R": case "r":
        case "T": case "t":
            ev.preventDefault();
            ev.stopPropagation();
            this.printChar(key);
            p.receiveKeyboardCode(-code);
            break;
        case "Enter":
            ev.preventDefault();
            ev.stopPropagation();
            this.printNewLine();
            p.receiveKeyboardCode(IOCodes.ioCodeCR);
            break;
        case "Tab":
            ev.preventDefault();
            ev.stopPropagation();
            this.printTab();
            p.receiveKeyboardCode(IOCodes.ioCodeTab);
            break;
        case "Escape":
            ev.preventDefault();
            ev.stopPropagation();
            if (!ev.repeating) {
                p.enableSwitchChange(1);
                this.$$("EnableSwitchOff").checked = false;
                this.$$("EnableSwitchOn").checked = true;
            }
            break;
        case "Backspace":
            ev.preventDefault();
            ev.stopPropagation();
            break;
        default:
            switch (ev.location) {
            case KeyboardEvent.DOM_KEY_LOCATION_STANDARD:
            case KeyboardEvent.DOM_KEY_LOCATION_NUMPAD:
                if (key.length == 1) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.printChar(key);
                }
                break;
            }
            break;
        }
    }

    /**************************************/
    panelKeyup(ev) {
        /* Handles the keyup event from FrontPanel */
        let p = this.processor;         // local copy of Processor reference

        switch (ev.key) {
        case "Escape":
            ev.preventDefault();
            ev.stopPropagation();
            p.enableSwitchChange(0);
            this.$$("EnableSwitchOff").checked = true;
            this.$$("EnableSwitchOn").checked = false;
            break;
        }
    }


    /*******************************************************************
    *  Typewriter Output                                               *
    *******************************************************************/

    /**************************************/
    setPaperEmpty() {
        /* Empties the printer output "paper" and initializes it for new output */

        this.paper.textContent = "";

        this.paper.appendChild(this.doc.createTextNode(""));
        this.printerLine = 0;
        this.printerCol = 0;
        this.paper.scrollTop = this.paper.scrollHeight; // scroll to end
    }

    /**************************************/
    printNewLine() {
        /* Appends a newline to the current text node, and then a new text
        node to the end of the <pre> element within the paper element */
        let paper = this.paper;
        let line = paper.lastChild.nodeValue;

        while (paper.childNodes.length > Typewriter.maxScrollLines) {
            paper.removeChild(paper.firstChild);
        }

        paper.lastChild.nodeValue = line.substring(0, line.length-1) + "\n";
        paper.appendChild(this.doc.createTextNode(Typewriter.cursorChar));
        ++this.printerLine;
        this.printerCol = 0;
        paper.scrollIntoView(false);
    }

    /**************************************/
    printChar(char) {
    /* Outputs the ANSI character "char" to the device */
        let line = this.paper.lastChild.nodeValue;
        let len = line.length;

        if (len < 1) {                  // first char on line
            this.paper.lastChild.nodeValue = char + Typewriter.cursorChar;
            this.printerCol = 1;
            this.paper.scrollTop = this.paper.scrollHeight;     // scroll line into view
        } else if (len <= Typewriter.maxCols) { // normal char
            this.paper.lastChild.nodeValue =
                    `${line.substring(0, len-1)}${char}${Typewriter.cursorChar}`;
            ++this.printerCol;
        } else {                        // right margin overflow -- overprint last col
             this.paper.lastChild.nodeValue = line.substring(0, Typewriter.maxCols-1) +
                    "\u2588" + Typewriter.cursorChar;
        }
    }

    /**************************************/
    printTab() {
        /* Simulates tabulation by inserting an appropriate number of spaces */
        let tabCol = Typewriter.maxCols;        // tabulation column (defaults to end of carriage)

        for (let x=0; x<this.tabStop.length; ++x) {
            if (this.tabStop[x] > this.printerCol) {
                tabCol = this.tabStop[x];
                break; // out of for loop
            }
        } // for x

        while (this.printerCol < tabCol) {
            this.printChar(" ");        // output a space
        }
    }

    /**************************************/
    write(code) {
        /* Writes one character code to the typewriter. The physical typewriter
        device (a standard Flexowriter tape punch unit) could output in excess
        of 8 characters per second, but the timing was controlled by the
        processor, which sent codes to the device at a rate of one every four
        drum cycles, about 8.6 characters per second */

        switch (code) {
        case IOCodes.ioCodeCR:
            this.printNewLine();
            break;
        case IOCodes.ioCodeTab:
            this.printTab();
            break;
        case IOCodes.ioCodeReload:
        case IOCodes.ioCodeStop:
        case IOCodes.ioCodeWait:
            // ignored by the typewriter
            break;
        default:
            /***** TEMP to provide automatic newline on line overflow - TEMP TEMP TEMP TEMP *****/
            //if (this.printerCol >= Typewriter.maxCols) {
            //    this.printNewLine();
            //}
            /****** end TEMP *****/

            this.printChar(Typewriter.printCodes[code]);
            break;
        }
    }

    /**************************************/
    extractPaper(ev) {
        /* Copies the text contents of the "paper" area of the device, opens a new
        temporary window, and pastes that text into the window so it can be copied
        or saved by the user */
        let text = this.paper.textContent;
        let title = "retro-g15 Typewriter Output";

        openPopup(this.window, "./FramePaper.html", "",
                "scrollbars,resizable,width=500,height=500",
                this, (ev) => {
            let doc = ev.target;
            let win = doc.defaultView;

            doc.title = title;
            win.moveTo((screen.availWidth-win.outerWidth)/2, (screen.availHeight-win.outerHeight)/2);
            doc.getElementById("Paper").textContent = text;
        });
    }

    /**************************************/
    savePaper() {
        /* Extracts the text of the typewriter paper area, converts it to a
        DataURL, and constructs a link to cause the URL to be "downloaded" and
        stored on the local device */
        let text = this.paper.textContent;

        if (text[text.length-1] == "_") {       // strip the cursor character
            text = text.slice(0, -1);
        }

        if (text[text.length-1] != "\n") {      // make sure there's a final new-line
            text = text + "\n";
        }

        const url = `data:text/plain,${encodeURIComponent(text)}`;
        const hiddenLink = this.doc.createElement("a");

        hiddenLink.setAttribute("download", "retro-g15-Typewriter-Paper.txt");
        hiddenLink.setAttribute("href", url);
        hiddenLink.click();
    }

    /**************************************/
    menuOpen() {
        /* Opens the Typewriter menu panel and wires up events */

        this.$$("TypewriterMenu").style.display = "block";
        this.$$("TypewriterMenu").addEventListener("click", this.boundMenuClick, false);
    }

    /**************************************/
    menuClose() {
        /* Closes the Typewriter menu panel and disconnects events */

        this.$$("TypewriterMenu").removeEventListener("click", this.boundMenuClick, false);
        this.$$("TypewriterMenu").style.display = "none";
    }

    /**************************************/
    menuClick(ev) {
        /* Handles click for the menu icon and menu panel */

        switch (ev.target.id) {
        case "TypewriterMenuIcon":
            this.menuOpen();
            break;
        case "TypewriterExtractBtn":
            if (this.ready) {
                this.extractPaper();
            }
            break;
        case "TypewriterPrintBtn":
            if (this.ready) {
                this.platen.contentWindow.print();
            }
            break;
        case "TypewriterSaveBtn":
            this.savePaper();
            break;
        case "TypewriterClearBtn":
            this.setPaperEmpty();
            //-no break -- clear always closes panel
        case "TypewriterCloseBtn":
            this.menuClose();
            break;
        }
    }

    /**************************************/
    shutDown() {
        /* Shuts down the device */

        this.$$("FrontPanel").removeEventListener("keydown", this.boundPanelKeydown, false);
        this.$$("FrontPanel").removeEventListener("keyup", this.boundPanelKeyup, false);
        this.paperDoc.removeEventListener("keydown", this.boundPanelKeydown, false);
        this.paperDoc.removeEventListener("keyup", this.boundPanelKeyup, false);
        this.$$("TypewriterMenuIcon").removeEventListener("click", this.boundMenuClick, false);
    }
} // class Typewriter
