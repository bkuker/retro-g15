//Assembler is too big a word for this.
//Its a .... Encoder.


/*
These are @UsagiElectric's notes from Discord

.13 s  .15.16.0.00.28    Number track checks; 111111 to AR
.16 .  .19.20.0.00.23    Format to Line 23, 3

.LL S P.TT.NN.C.SS.DD BP
     .LL  0 > Location of instruction on drum
      S   0 > ???
      P   1 > Prefix U or W, controls block command and normal command
     .TT  7 > T or LK:
            T  - Timing number, the address in the line where the operand is
            LK - Word position of the command plus K
     .NN  7 > Word location of the next instruction
     .C   3 > Characteristic, 
     .SS  5 > Source, the line where the operand is located
     .DD  5 > Destination, the line where the operand will be located
      BP  1 > Break Point, CPU pause on - here and switch in BP
*/

import fs from "fs";

const data = fs.readFileSync('software/tools/fib.asm', 'utf-8'); // Read file synchronously
const lines = data.split(/\r?\n/); // Split into lines

let program = []; //The commands and comments in PROGRM order, not location order

for (const rawText of lines) {
    if (rawText.trim().startsWith("#")) {
        continue;   //Ignore Comment
    } if (rawText.trim().length == 0) {
        continue;   //Ignore blank space
    }

    //Each line follows the pattern:
    //  LL S P.TT.NN.C.SS.DD BP
    //Taken from the programming problem worksheet
    //and various published source listings.

    //Extract the Location and s columns
    let l = g15DecToInt(rawText.substring(1, 3));
    let s = rawText.substring(4, 5);

    if (s == "." || s == "s") {
        //If s is "." or "s" this is an instruction

        //Extract the rest
        let p = rawText.substring(6, 7);
        let t = rawText.substring(8, 10);
        let n = rawText.substring(11, 13);
        let c = rawText.substring(14, 15);
        let src = rawText.substring(16, 18);
        let dst = rawText.substring(19, 21);
        let bp = rawText.substring(22, 23);
        let comment = rawText.substring(24).trim();

        //Place into an object
        let cmd = {
            rawText,
            l,
            s,
            p,
            t: g15DecToInt(t),
            n: g15DecToInt(n),
            c: +c,
            src: +src,
            dst: +dst,
            bp: bp.trim().length > 0,
            comment
        }

        //This is the command's actual binary value as an integer
        cmd.word = commandToInstructionWord(cmd);

        program.push(cmd);
    } else {
        //TODO: Support double precision constants?

        //There was not a "." or "s" in the s column...
        //This is a constant in +/- hex form
        let val = rawText.substring(4, 20).trim();

        //Separate sign bit from absolute value hex
        let neg = false;
        if (val.startsWith("-")) {
            val = val.substring(1);
            neg = true;
        }

        //convert the abs to an integer
        let valNum = g15HexToDec(val);

        //Convert that integer and sign into the
        //raw g15 word
        let word = Math.abs(valNum) << 1;
        if (neg) {
            word = word | 0x01;
        }

        //Extract the comment
        let comment = rawText.substring(24).trim();

        //Place into an object
        let data = {
            rawText,
            l,
            word,
            value: valNum * (neg ? -1 : 1),
            comment
        }
        program.push(data);
    }

}

//Order the program by location.
let line = [];  //An array with each command at it's L value. (sparse)
for ( let cmd of program ){
    line[cmd.l] = cmd;
}

//Convert the program to an array of words at the appropriate locations
let lineWords = [];
for (let l = 0; l < 108; l++) {
    if (line[l]) {
        lineWords[l] = line[l].word;
    } else {
        lineWords[l] = 0;
    }
}

function lineToTape(lineWords) {
    /**
     * This function takes a 108 long array of integers
     * and converts it to a string in the .pti format
     * described at:
     * 
     * https://github.com/retro-software/G15-software/ 
     */


    //Convert lineWords into a binary string
    let bin = "";
    for (let l = 0; l < 108; l++) {
        let b = ((lineWords[l] >>> 0).toString(2).padStart(29, "0"));
        bin = b + bin;
    }

    //Convert binary to tape
    let chunks = bin.match(/.{1,116}/g);
    let ptiBlock = "";
    const SYM = "0123456789uvwxyz";
    for (let i = 0; i < chunks.length; i++) {
        let out = "";
        let nibbles = chunks[i].match(/.{1,4}/g);
        for (let nibble of nibbles) {
            let v = parseInt(nibble, 2);
            out += SYM[v];
        }
        ptiBlock = ptiBlock + out;
        //Apply the appropriate line ending
        ptiBlock = ptiBlock + (i == chunks.length - 1 ? "S" : "/\n");
    }
    return ptiBlock;

}

//Print out the PTI
console.log(lineToTape(lineWords));

function g15DecToInt(v) {
    /**
     * Converts a G15 decimal number to an integer.
     * Numbers less than 100 are just normal, but
     * numbers greater than 100 have a u in the tens
     * place and so on. 107 = u7.
     */
    v = v.replace("u", "10");
    v = v.replace("v", "11");
    return +v;
}

function formatCommand(c) {
    /**
     * Returns a formatted version of a command object in the same format
     * as the input.
     */
    return `.${c.l} ${c.s} ${c.p}.${c.t}.${c.n}.${c.c}.${c.src}.${c.dst} ${c.bp ? "-" : " "}  ${c.comment}`;
}

function commandToInstructionWord(c) {
    /**
     * Converts a command object into an instruction word.
     * Returns an integer, not g15 hex
     */
    let o = 0;
    o = o | (c.dst << 1);
    o = o | (c.src << 6);

    //Disassembler shows C as
    //(dp*4 + c)

    o = o | ((c.c & 0b11) << 11);
    o = o | (c.c >> 2); //TODO CHECK SINGLE vs DOUBLE

    o = o | (c.n << 13);
    o = o | ((c.bp ? 1 : 0) << 20);
    o = o | (c.t << 21);

    //Is this deferred?
    // Prefix u: i/d = 0 immediate
    //        w: i/d = 1 deferred
    //    blank: i/d = 1 deferred
    //           UNLESS dest = 31 or t = l + 1
    const DEFERRED = 1;
    const IMMEDIATE = 0;
    let id;
    if (c.p == "u") {
        id = IMMEDIATE;
    } else if (c.p == "w") {
        id = DEFERRED;
    } else if (c.p == " ") {
        if (c.dst == 31) {
            id = IMMEDIATE;
        } else if (c.t == c.l + 1) {
            id = IMMEDIATE;
        } else {
            id = DEFERRED;
        }
    }
    o = o | (id << 28);

    return o;
}

function g15HexToDec(v) {
    /**
     * Convert a string in bendix hex to an integer
     */
    v = v.toLowerCase();
    v = v.replace("u", "a");
    v = v.replace("v", "b");
    v = v.replace("w", "c");
    v = v.replace("x", "d");
    v = v.replace("y", "e");
    v = v.replace("z", "f");
    return parseInt(v, 16);
}

function g15Hex(v) {
    /**
     * Converts the value "v" to a hexidecimal string using the G-15
     */
    const hexRex = /[abcdefABCDEF]/g;   // standard hex characters
    return v.toString(16).replace(hexRex, (c) => {
        switch (c) {
            case "a": case "A":
                return "u";
            case "b": case "B":
                return "v";
            case "c": case "C":
                return "w";
            case "d": case "D":
                return "x";
            case "e": case "E":
                return "y";
            case "f": case "F":
                return "z";
            default:
                return "?";
        }
    }).padStart(8, "0");
}