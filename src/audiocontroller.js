
export default class AudioController  {
    constructor() {
        let PP = new Spectrum();
        let Finder = new PitchFinder();

        let frameBuffer = 4; //frames
        let bufferMemory = []; //will be a 2D then

        this.pause = false;
        
        let sup = this;

        function loop() {
            if (PP.gotStream) {
                //GET DATA
                const binData = PP.spectrum;
                PP.updateEnergyValues(PP.spectrum);
                
                //var freq = YINDetector(binData)
                //sup.onFrame(freq);

                //CRUNCH DATA
                Finder.findPolyPhonic(binData, 0.25);
                let winnerMidis = Finder.legitMidis || [];
                bufferMemory.unshift(winnerMidis);
                bufferMemory.splice(frameBuffer, 2);
                
                if(sup.onFrame !== undefined) {
                    if(winnerMidis.length > 0) {
                        sup.onFrame(winnerMidis[0] % 12);
                    } else {
                        sup.onFrame(null);
                    }
                }
            }
            requestAnimationFrame(loop);
        }
        
        window.onload = () => loop();
    }
}

const Spectrum = class {
    constructor(callback = function () {
        // console.log("Your callback could be here")
    }) {

        //SETTING UP WEB AUDIO
        window.AudioContext = window.AudioContext || window.webkitAudioContext; //as of spring 2017...maybe need to add more prefixes later
        this.audioCtx = new window.AudioContext(); //TODO prefix add

        //Setup analyser
        this.analyserNode = this.audioCtx.createAnalyser(); //automatically creates and CONNECTS AnalyserNode to AudioSource
        this.analyserNode.fftSize = 16384; //default is 2048...for the tonedeaf...; HAS TO be multiple of 2
        this.analyserNode.minDecibels = -80;
        this.data = new Uint8Array(this.analyserNode.frequencyBinCount); //TODO: make UI option between 4 ArrayDataTypes

        this.BINCOUNT = 500; //covers until Midi 88
        this.THRESHOLD = 1; //minimal energy to be considered alive
        this.displayAbsolute = true;

        this.hzPerBin = this.audioCtx.sampleRate / this.analyserNode.fftSize; //the range every bin captures

        //Set the Data that doesn't change in the loop (most things except energy)
        this.spectrum = this.dataSetup(); //this [{}] can be extended for Xmappings and other features
        //GETTING MIC ACCESS
        navigator.getUserMedia = ( navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);

        navigator.getUserMedia({audio: true}, (stream) => { //arrow function needed to make 'this...' work properly
            stream.onended = () => console.log('Stream ended');
            const source = this.audioCtx.createMediaStreamSource(stream);//set the stream to link to the AudioContext...it's strange I know
            source.connect(this.analyserNode); //this is working in the background...so might need to unplug somehow if performance is issue
            // console.log("STREAM: " + stream, "SOURCE: " + source)
            // console.log('started my Loop -PP');
            this.gotStream = true;
            callback(); //optional
        }, function (err) {
            alert ("Looks like you denied Microphone access or your browser blocked it. \nTo make it work: " +

                "\n\n>In 95% of cases: Click the green/secure bar or green lock icon left of the URL address bar (left of https://dacapo....)\n " +
                "\n\n If you can't see it: Check the -Settings- in your browser " +
                "\n\n>In CHROME it's | Settings => Content settings => Microphone| \n" +
                "\n>You can also try to reload the page and if nothing helps update your browser / delete your cookies \n" +
                "\n>If you are on Safari or Internet Explorer I lost all hopes for you \n" +
                "\n Good Luck!")
        });

        this.heighestEnergy;
        this.legitMidis = [];
        this.legitNotes = [];
    }

    updateBinCount (binCount) {
        this.BINCOUNT = binCount;
        this.spectrum = this.dataSetup();
    }

    dataSetup () {
        const seg = [];
        const pp = this; //reference inside obj

        for (let binNr = 0; binNr < this.BINCOUNT; binNr++) {
            const obj = {
                midi: pp.binToMidi(binNr),
                binNr: binNr,
                energyRel: 0.2, //default before first loop
                energyAbs: 1, //default
                hz: binNr * pp.hzPerBin
            };

            const midi = obj.midi;
            obj.color = pp.midiToHSLa(midi); //avoid NaN. obj values are not set in sequence weirdly
            obj.note = pp.midiToNoteName(midi);
            obj.noteDeluxe = pp.midiToNoteName(midi, "deluxe");

            seg.push(obj);
        }
        return seg;
    }
    //TICK TICK TICK ...every frame or whatever
    updateEnergyValues(mySpec) { //needs data which needs a stream which needs a audiocontext ladilalalala
        this.analyserNode.getByteFrequencyData(this.data); //TODO make this link to user choice

        this.segment = this.data.slice(0, this.BINCOUNT);
        //ATTENTION --> indexes might get mixed up if beginning isn't 0 //so .filter,.slice,.splice will cause bugs later on

        this.heighestEnergy = 0;
        this.mostEnergyBin = 0;
        for(let i = 0; i < this.segment.length; i++) {
            const binEnergy = this.segment[i]
            mySpec[i].energyAbs = binEnergy;

            if (binEnergy > this.heighestEnergy) { //update the chosen one
                this.heighestEnergy = binEnergy;
                this.mostEnergyBin = i;
            }
        }

        if (this.displayAbsolute) {
            this.heighestEnergy = 255;
        }

        mySpec.forEach((el) => el.energyRel = el.energyAbs / (this.heighestEnergy+0.001)); //to avoid NaN ( divide by 0.. )
//
// this.normalizedBinIdx = this.correctToLowestPeak(this.winBinIdx, this.segment); //independet from mySpec
    }

    binToMidi (bin) {
        if (Array.isArray(bin)) {
            throw new DOMException('dont input array as argument');
        }
        return this.hzToMidi(bin * this.hzPerBin);
    }

    hzToMidi(Hz) {
        if (Hz <= 0) {
            return -1;
        }
        const multipleOfBase = Hz / 8.1757989156; //8.17 is C0 which is MIDI 0 for standard tuning
        const midi = 12 * getBaseLog(2, multipleOfBase); //2 as base because = 1 octave
        if (midi < 0) {return -1}
        else return midi;

        function getBaseLog (x, y) { //returns the logarithm of y with base x (ie. logxy):
            return Math.log(y) / Math.log(x);
        }
    }

    midiToHz(midi) {
        let base = 8.1757989156; //Midi 0 according to: "THE INTERNET"
        let totalOctaves = 10; //from midi 0 to midi 120
        let multiplier = Math.pow(2, totalOctaves *   midi / 120); //genius! forgot why
        let frequency = base * multiplier; // in HZ
        return frequency;
    }
    midiToBin(midi) {
        return this.midiToHz(midi) / this.hzPerBin;
    }

    midiToHSLa (midi, s = "100%", l = "60%", a = 1) { //HSL is more intuitive then RGB s=100, l =60;
        const segments = 12;
        midi = midi % segments;
        let h = 360 - (midi * 360 / segments) + 60; //Hue goes gradually around (COUNTERCLOCK) the wheel at pitch '6' => 180deg
        if (h == 360) {h = 0;}
        return "hsla" + "(" + h + "," + s + "," + l + "," + a + ")";
    }

    midiToNoteName(midi, which="none") {
        midi = Math.round(midi);
        const allNoteNames = [
            //    "C -2","C# -2","D -2","D# -2", "E -2","F -2","F# -2","G -2", "G# -2", "A -2", "A# -2", "B -2", //some note it differently
            "C -1","C# -1","D -1","D# -1", "E -1","F -1","F# -1","G -1", "G# -1", "A -1", "A# -1", "B -1",
            "C 0","C# 0","D 0","D# 0", "E 0","F 0","F# 0","G 0", "G# 0", "A 0", "A# 0", "B 0",
            "C 1","C# 1","D 1","D# 1", "E 1","F 1","F# 1","G 1", "G# 1", "A 1", "A# 1", "B 1",
            "C 2","C# 2","D 2","D# 2", "E 2","F 2","F# 2","G 2", "G# 2", "A 2", "A# 2", "B 2",
            "C 3","C# 3","D 3","D# 3", "E 3","F 3","F# 3","G 3", "G# 3", "A 3", "A# 3", "B 3",
            "C 4","C# 4","D 4","D# 4", "E 4","F 4","F# 4","G 4", "G# 4", "A 4", "A# 4", "B 4",
            "C 5","C# 5","D 5","D# 5", "E 5","F 5","F# 5","G 5", "G# 5", "A 5", "A# 5", "B 5",
            "C 6","C# 6","D 6","D# 6", "E 6","F 6","F# 6","G 6", "G# 6", "A 6", "A# 6", "B 6",
            "C 7","C# 7","D 7","D# 7", "E 7","F 7","F# 7","G 7", "G# 7", "A 7", "A# 7", "B 7",
            "C 8","C# 8","D 8","D# 8", "E 8","F 8","F# 8","G 8", "G# 8", "A 8", "A# 8", "B 8",
        ];
        const chromaticC3 = [ //could also produce allNoteNames from this with Midi knowledge
            "C",
            "C''",
            "D",
            "D''",
            "E",
            "F",
            "F''",
            "G",
            "G''",
            "A",
            "A''",
            "B",
            "C"
        ];
        return which === "deluxe" ? allNoteNames[midi] : chromaticC3[midi % 12];
    }
}

const PitchFinder = class {
constructor () {
}

findPolyPhonic(binData, legitEnergy = 0.2) {

        const allBins = binData.slice();
        let topBins = [];
        allBins.forEach ( (bin) => {
            if (bin.energyRel > legitEnergy) {
                topBins.push(bin.binNr);
            };
        });

        topBins = Array.from(new Set(topBins));
        topBins.sort((a,b) => a - b);



        let reducedBins2D = this.clusterNeighbors(topBins); //rename function name [1,2,5,6,15,16] => [ [1,2], [5,6], [15,16] ];
        //use clusterbyMidis for audio stuff -- not really related to what we hear but actual phys. sound
        let winnerBins;
        if (!reducedBins2D) {
            return;
        }
        if (reducedBins2D[0].length) { //sign of life
            winnerBins = reducedBins2D
                .map(function winnerInGroup(array) {
                    // ---- TEST best reduction here. Might be just biggest, might be interpolation or average of neighbors
                    return array
                        .reduce(function (biggest, binNr) { //dangerous reducing going on here. From neighborgroup reference to data and find heighest
                                if (allBins[binNr].energyAbs >= allBins[biggest].energyAbs) {
                                    biggest = binNr;
                                }
                                return biggest
                            },
                            array[0]); //by default take first neighbor. end of reduce
                }); //end of map
        }
        //

    let top = winnerBins || [];
    winnerBins = winnerBins || [];

        // winnerBins = winnerBins.map( binIdx => this.correctToLowestPeak(binIdx, PP.segment));

        //
        this.myTopBins = top; //just for debugging


        let topMidisRound = top.map(bin => Math.round(allBins[bin].midi));
        topMidisRound = Array.from(new Set(topMidisRound));

    let endRange = topMidisRound[0] + 23; //2 Octaves w/o itself (FAC ==> every note played should have same count)

    topMidisRound = this.clipMidis(topMidisRound, topMidisRound[0], endRange);
    this.topMidis = topMidisRound;

    const maxCount = this.findNoteCountMax(topMidisRound);
    const midisPerNote2D = this.groupMidisbyNote2D(topMidisRound);

    //here you can check for other than maxCount and combine
    const noteGuesses = this.notesWithCountX(midisPerNote2D, maxCount);

    this.displayMidis = topMidisRound
            .filter(midi => noteGuesses.includes(midi % 12) &&
        !(topMidisRound.includes(midi -12) || topMidisRound.includes(midi -24)));


        //filter for noteGuesses and flatten

        this.legitNotes = noteGuesses;
        this.legitMidis = this.displayMidis;

    }

    clipMidis (midis, start, end) {
    return midis.filter( midi => midi >= start && midi <= end);
    }

    findNoteCountMax (midis) {
        let maxCount = 0;
        for (let noteChrom = 0; noteChrom <= 11; noteChrom++) {
            let count = midis
                    .filter(midi => midi % 12 === noteChrom).length;
            if ( count > maxCount ) {
                maxCount = count;
            }
        }
        return maxCount;
    }

    groupMidisbyNote2D (midis) {
        let noteMidis = [];
        for (let noteChrom = 0; noteChrom <= 11; noteChrom++) {

            noteMidis
                .push(midis
                        .filter(midi => (midi % 12) === noteChrom));

        }
        return noteMidis;
    }

    notesWithCountX (midis2D, count) {
        if (!count) return [];

        let notes = [];

        midis2D.forEach((midis, idx) =>
        {
            if (midis.length === count) {
                notes.push(midis[0] % 12); //since every midi in the inner array is same note
            }
        });
        notes =notes.sort((a,b) => a - b);
        return notes;
    }

    isOctaveTooHigh (binIdx, binData, legit = 1/15) { //shit workaround code here
        const imagOct = binIdx / 2;
        const legitVal = 220 * legit;
        const oct3 = binData[imagOct*3];
        const oct5 = binData[imagOct*5];
        const oct7 = binData[imagOct*7];

        if (!oct3 || !oct5 || !oct7) {
            return false;
        }
        else if (oct3.energyAbs > legitVal &&
            oct5.energyAbs > legitVal &&
            oct7.energyAbs > legitVal)
        {
            return true;
        }
        return false;
    }

    clusterBinsByMidi (bins = [[-1]], binData) {
        if (!bins.length || !binData.length) {
            return;
        }
        bins = bins.slice();
        let prevMidi = Math.round(binData[bins[0]].midi);
        let reducedBins = [[]]; //will be 2D array
        let group = 0; //pushes new values to current group
        for (let i = 0; i < bins.length; i++) {
            let myMidi = Math.round(binData[bins[i]].midi);
            if (prevMidi == myMidi) { //should work w/o Math.abs
                reducedBins[group].push(bins[i]); //new value in group
            } else {
                reducedBins.push([bins[i]]); //new array with value inside reducedBins
                group++;
            }
            prevMidi = myMidi;
        }
        return reducedBins;
    }

    clusterNeighbors(bins) {
        let reducedBins = [[]]; //will be 2D array
        let prev = bins[0];
        let group = 0; //pushes new values to current group
        for (let i = 0; i < bins.length; i++) {
            if ( Math.abs(bins[i] - prev) < 2) { //should work w/o Math.abs
                reducedBins[group].push(bins[i]); //new value in group
            } else {
                reducedBins.push([bins[i]]); //new array with value inside reducedBins
                group++;
            }
            prev = bins[i];
        }
        return reducedBins;
    }

    correctToLowestPeak(biggestIdx, spectrumData) { //divide neighbors as well and search...
        var newIdx = biggestIdx; //by default
        for (var divisor = 6; divisor >= 2; divisor-= 1) {

            var smallerIdx = Math.round(biggestIdx / divisor); //had problems bc I didn't use .round and JS didn't throw errorMsg
            //function silently didn't compare float bin values...
            var ratio = this.heighestEnergy / spectrumData[smallerIdx];
            if (ratio > 0.3 && ratio < 8) //if energies are close together...
            {
                //---check neighbors to be sure
                if (spectrumData[smallerIdx] > spectrumData[smallerIdx + 1]) { //compares neighors energy values
                    newIdx = smallerIdx;
                }
                if (spectrumData[smallerIdx + 1] > spectrumData[smallerIdx]) {
                    newIdx = smallerIdx + 1;
                }
                if (spectrumData[smallerIdx - 1] > spectrumData[smallerIdx]) { //
                    newIdx = smallerIdx - 1;
                }
                if (spectrumData[smallerIdx - 2] > spectrumData[smallerIdx]) { //
                    newIdx = smallerIdx - 2;
                }
            }
        }
        return newIdx;
    }
}

// top.forEach((binIdx, topIdx) => {
//     if(this.isOctaveTooHigh(binIdx, allBins)) {
//         top.splice(topIdx, 1);
//     }
// });

const DEFAULT_THRESHOLD = 0.10;
const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_PROBABILITY_THRESHOLD = 0.1;

const threshold = DEFAULT_THRESHOLD;
const sampleRate = DEFAULT_SAMPLE_RATE;
const probabilityThreshold = DEFAULT_PROBABILITY_THRESHOLD;

function noteFromPitch( frequency ) {
    var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
    return Math.round( noteNum ) + 69;
}

function YINDetector (float32AudioBuffer) {
    // Set buffer size to the highest power of two below the provided buffer's length.
    let bufferSize;
    for (bufferSize = 1; bufferSize < float32AudioBuffer.length; bufferSize *= 2);
    bufferSize /= 2;

    // Set up the yinBuffer as described in step one of the YIN paper.
    const yinBufferLength = bufferSize / 2;
    const yinBuffer = new Float32Array(yinBufferLength);

    let probability, tau;

    // Compute the difference function as described in step 2 of the YIN paper.
    for (let t = 0; t < yinBufferLength; t++) {
        yinBuffer[t] = 0;
    }
    for (let t = 1; t < yinBufferLength; t++) {
        for (let i = 0; i < yinBufferLength; i++) {
        const delta = float32AudioBuffer[i] - float32AudioBuffer[i + t];
        yinBuffer[t] += delta * delta;
        }
    }

    // Compute the cumulative mean normalized difference as described in step 3 of the paper.
    yinBuffer[0] = 1;
    yinBuffer[1] = 1;
    let runningSum = 0;
    for (let t = 1; t < yinBufferLength; t++) {
        runningSum += yinBuffer[t];
        yinBuffer[t] *= t / runningSum;
    }

    // Compute the absolute threshold as described in step 4 of the paper.
    // Since the first two positions in the array are 1,
    // we can start at the third position.
    for (tau = 2; tau < yinBufferLength; tau++) {
        if (yinBuffer[tau] < threshold) {
        while (tau + 1 < yinBufferLength && yinBuffer[tau + 1] < yinBuffer[tau]) {
            tau++;
        }
        // found tau, exit loop and return
        // store the probability
        // From the YIN paper: The threshold determines the list of
        // candidates admitted to the set, and can be interpreted as the
        // proportion of aperiodic power tolerated
        // within a periodic signal.
        //
        // Since we want the periodicity and and not aperiodicity:
        // periodicity = 1 - aperiodicity
        probability = 1 - yinBuffer[tau];
        break;
        }
    }

    // if no pitch found, return null.
    if (tau == yinBufferLength || yinBuffer[tau] >= threshold) {
        return null;
    }

    // If probability too low, return -1.
    if (probability < probabilityThreshold) {
        return null;
    }


    /**
     * Implements step 5 of the AUBIO_YIN paper. It refines the estimated tau
     * value using parabolic interpolation. This is needed to detect higher
     * frequencies more precisely. See http://fizyka.umk.pl/nrbook/c10-2.pdf and
     * for more background
     * http://fedc.wiwi.hu-berlin.de/xplore/tutorials/xegbohtmlnode62.html
     */
    let betterTau, x0, x2;
    if (tau < 1) {
        x0 = tau;
    } else {
        x0 = tau - 1;
    }
    if (tau + 1 < yinBufferLength) {
        x2 = tau + 1;
    } else {
        x2 = tau;
    }
    if (x0 === tau) {
        if (yinBuffer[tau] <= yinBuffer[x2]) {
        betterTau = tau;
        } else {
        betterTau = x2;
        }
    } else if (x2 === tau) {
        if (yinBuffer[tau] <= yinBuffer[x0]) {
        betterTau = tau;
        } else {
        betterTau = x0;
        }
    } else {
        const s0 = yinBuffer[x0];
        const s1 = yinBuffer[tau];
        const s2 = yinBuffer[x2];
        // fixed AUBIO implementation, thanks to Karl Helgason:
        // (2.0f * s1 - s2 - s0) was incorrectly multiplied with -1
        betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / betterTau;
};