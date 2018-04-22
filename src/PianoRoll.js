import React, { Component } from 'react';

var colorstyles = [
    "#ff0000", "#ff0000",
    "#00d400", "#00d400",
    "#c87137",
    "#ffff00", "#ffff00",
    "#2c5aa0", "#2c5aa0",
    "#9955ff", "#9955ff",
    "#00ffff"
];
var colorGoldStyle = "rgba(213,173,109,1)";

var blackKeys = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
var noteLabels = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var posTop = 0;

class PianoRoll extends Component {
    constructor(props) {
        super(props);
        this.state = { playing: false, selection: [], activeVoice: 0 };
        
        this.minKey = 36;
        this.maxKey = 88;
        this.notes = [];
        this.timeLine = [];
        this.triggeredKeys = [];
        this.yOffset = 0;

        this.playing = false;
        this.time = 0;
        this.lastHighlightedNotes = [];

        this.selection = [];
        this.downNote = null;
        this.downNoteBackup = null;
        this.musicVo = null;        

        // handle window resizing
        window.addEventListener('resize', () => this.resize(), false);
    }

    componentDidMount() {
        this.canvasContext = this.canvas.getContext("2d");
        if (this.props.musicVo != null) {
            this.load(this.props.musicVo);
        }
    }

    componentDidUpdate(prevProps, prevState) {
        this.resize();
    }

    loop() {
        var now = Date.now();
        var dt = (now - this.lastUpdate) / 1000 * this.props.musicVo.MusicInfo.Tempo / 60 / 4;
        this.lastUpdate = now;
        
        //this.time += dt;
        if(this.currentNote == undefined || this.currentNote.Midi == -1) {
            this.time += dt;
        } else if(this.note != null) {
            if(this.note == this.currentNote.Midi % 12) {
                this.time += dt;
            }
        }

        this.update();

        requestAnimationFrame(() => this.loop());
    }

    update() {
        this.playing = true;

        if (this.playing) {
            if (this.time >= this.measuresCount) {
                this.props.onFinish();
                this.playing = false;
                this.time = 0;
            }
        }

        var timeSlot = Math.floor(this.time * this.musicVo.MusicInfo.MeasureDuration);

        [timeSlot - 2, timeSlot - 1, timeSlot].every(function (element, index, arr) {
            if (element >= 0 && this.timeLine[element] != undefined) {
                this.timeLine[element].forEach(function (note) {
                    if (this.time >= note.Time && this.time < note.Time + note.Duration) {
                        this.currentNote = note;
                    }
                }, this);
            }
            return true;
        }, this);

        this.draw();

        this.props.onUpdate(this.time / (this.musicVo.MusicInfo.Duration * this.musicVo.MusicInfo.MeasureDuration) * 100, this.currentNote.Midi);
    }

    load(musicVo) {
        this.musicVo = musicVo;
        this.notes = [];
        this.timeLine = [];

        this.minKey = 120;
        this.maxKey= 0;
        for (var l = 0; l < musicVo.Parts.length; l++) {
            for (var k = 0; k < musicVo.Parts[l].Measures.length; k++) {
                for (var v = 0; v < musicVo.Parts[l].Measures[k].Voices.length; v++) {
                    var voice = musicVo.Parts[l].Measures[k].Voices[v];
                    for (var i = 0; i < voice.Notes.length; i++) {                        
                        voice.Notes[i].Midi.forEach(function (midi) {
                            if(midi > 0) {
                                if(midi < this.minKey)
                                    this.minKey = midi;
                                if(midi > this.maxKey)
                                    this.maxKey = midi;
                            }
                        }, this);
                    }
                }
            }
        }
        
        this.minKey -= 8;
        this.maxKey += 8;

        this.measuresCount = musicVo.Parts[0].Measures.length;
        for (var l = 0; l < musicVo.Parts.length; l++) {
            for (var k = 0; k < musicVo.Parts[l].Measures.length; k++) {
                for (var v = 0; v < musicVo.Parts[l].Measures[k].Voices.length; v++) {
                    var voice = musicVo.Parts[l].Measures[k].Voices[v];
                    var durationCounter = k * this.musicVo.MusicInfo.MeasureDuration;
                    for (var i = 0; i < voice.Notes.length; i++) {
                        if (voice.Notes[i].TieStop !== true) {
                            var noteDuration = voice.Notes[i].Duration;
                            if (voice.Notes[i].TieStart === true) {
                                var tieNote = {
                                    PartIndex: l,
                                    MeasureIndex: k,
                                    VoiceIndex: v,
                                    NoteIndex: i,
                                    Note: voice.Notes[i]
                                };
                                do {
                                    if (tieNote.NoteIndex < musicVo.Parts[tieNote.PartIndex].Measures[tieNote.MeasureIndex].Voices[tieNote.VoiceIndex].Notes.length - 1) {
                                        tieNote = {
                                            PartIndex: tieNote.PartIndex,
                                            MeasureIndex: tieNote.MeasureIndex,
                                            VoiceIndex: tieNote.VoiceIndex,
                                            NoteIndex: tieNote.NoteIndex + 1,
                                            Note: musicVo.Parts[tieNote.PartIndex].Measures[tieNote.MeasureIndex]
                                                .Voices[tieNote.VoiceIndex].Notes[tieNote.NoteIndex + 1]
                                        };
                                        noteDuration += tieNote.Note.Duration;
                                    } else if (tieNote.MeasureIndex < musicVo.Parts[tieNote.PartIndex].Measures.length - 1) {
                                        tieNote = {
                                            PartIndex: tieNote.PartIndex,
                                            MeasureIndex: tieNote.MeasureIndex + 1,
                                            VoiceIndex: tieNote.VoiceIndex,
                                            NoteIndex: 0,
                                            Note: musicVo.Parts[tieNote.PartIndex].Measures[tieNote.MeasureIndex + 1]
                                                .Voices[tieNote.VoiceIndex].Notes[0]
                                        };
                                        noteDuration += tieNote.Note.Duration;
                                    } else {
                                        tieNote = null;
                                    }
                                } while (tieNote !== null && tieNote.Note.TieStart === true)
                            }

                            voice.Notes[i].PianoRole = [];
                            var midiIndex = 0;
                            voice.Notes[i].Midi.forEach(function (midi) {
                                this.pushNote(midi, durationCounter, noteDuration, voice.Notes[i], [l, k, v, i, midiIndex], voice.Staff);
                                midiIndex++;
                            }, this);
                        }

                        durationCounter += voice.Notes[i].Duration;
                    }
                }
            }
        }

        this.resize();

        this.lastUpdate = Date.now();
        this.loop();
    }

    pushNote(midi, time, duration, parent, coords, staff) {
        var note = {
            left: 0,
            top: time,
            height: duration - 0.01,
            color: colorstyles[midi % 12],
            hover: false,
            opacity: 1,
            mute: false,
            rest: false,
            staff: staff
        };

        if (midi < 0) {
            note.rest = true;
            note.width = 1;
            note.left = 0;
            if (staff == 1) {
                note.left = 0;
            } else {
                for (var j = this.minKey; j < this.maxKey; j++) {
                    if (blackKeys[j % 12] === 0) {
                        note.left++;
                    }
                }
            }
        } else {
            note.left = 0;
            for (var j = this.minKey; j < midi; j++) {
                if (blackKeys[j % 12] === 0) {
                    note.left++;
                }
            }
            if (blackKeys[midi % 12] === 0) {
                note.width = 1;
            } else {
                note.width = 2 / 3;
                note.left -= 1 / 3;
            }
        }

        this.notes.push(note);
        if (this.timeLine[Math.floor(time * this.musicVo.MusicInfo.MeasureDuration)] == undefined) {
            this.timeLine[Math.floor(time * this.musicVo.MusicInfo.MeasureDuration)] = [];
        }
        this.timeLine[Math.floor(time * this.musicVo.MusicInfo.MeasureDuration)].push({ Midi: midi, Time: time, Duration: duration, Block: note, Parent: parent, Coords: coords});
        return note;
    }

    resize() {
        if(window.innerHeight > window.innerWidth){
            this.durationWindow = 1;
        } else {
            this.durationWindow = 2;
        }

        this.canvasWidth = this.container.offsetWidth;
        this.canvasHeight = this.container.offsetHeight;

        this.canvasContext.canvas.width = this.canvasWidth;
        this.canvasContext.canvas.height = this.canvasHeight;

        var range = 0;
        for (var i = this.minKey; i <= this.maxKey; i++) {
            if (blackKeys[i % 12] === 0) {
                range++;
            }
        }

        this.ebonyKeyWidth = 2 / 3 * (this.canvasHeight) / range;
        this.ivoryKeyWidth = 3 / 3 * (this.canvasHeight) / range;
        this.ivoryKeyHeight = this.ivoryKeyWidth * 2.5;
        this.ebonyKeyHeight = this.ivoryKeyWidth * 1.25;

        this.yOffset = this.canvasWidth - this.ivoryKeyHeight;
        this.durationHeight = this.canvasWidth / this.durationWindow;

        this.draw();
    }

    draw() {
        this.canvasContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        var offset = this.time * this.durationHeight;

        this.canvasContext.save();
        this.canvasContext.translate(-offset, 0);
        var timeSlot = Math.floor(this.time * this.musicVo.MusicInfo.MeasureDuration);
        // ivory notes
        [timeSlot - 4, timeSlot - 3, timeSlot - 2, timeSlot - 1, timeSlot, timeSlot + 1, timeSlot + 2, timeSlot + 3, timeSlot + 4, timeSlot + 5, timeSlot + 6].every(function (element, index, arr) {
            if (element >= 0 && this.timeLine[element] != undefined) {
                this.timeLine[element].forEach(function (note) {
                    if (blackKeys[note.Midi % 12] == 0)
                        this.drawNote(note);
                }, this);
            }
            return true;
        }, this);
        // ebony notes
        [timeSlot - 4, timeSlot - 3, timeSlot - 2, timeSlot - 1, timeSlot, timeSlot + 1, timeSlot + 2, timeSlot + 3, timeSlot + 4, timeSlot + 5, timeSlot + 6].every(function (element, index, arr) {
            if (element >= 0 && this.timeLine[element] != undefined) {
                this.timeLine[element].forEach(function (note) {
                    if (blackKeys[note.Midi % 12] == 1)
                        this.drawNote(note);
                }, this);
            }
            return true;
        }, this);

        this.canvasContext.restore();
    }

    drawNote(note) {
        var posY = note.Block.top * this.durationHeight;
        var sizeY = note.Block.height * this.durationHeight;
        if (true){//posY + sizeY + posTop > 0 && posY + posTop < this.canvasWidth) {
            this.canvasContext.beginPath();

            if (note.Block.rest == true) {
                this.canvasContext.globalAlpha = 0.2;
                this.canvasContext.fillStyle = "#555555";
                let offY = 0;
                if (note.Block.staff == 1) {
                    offY = this.canvasHeight - this.ivoryKeyWidth;
                }

                this.canvasContext.fillRect(
                    posY,
                    offY,
                    sizeY,
                    note.Block.width * this.ivoryKeyWidth
                );

                this.canvasContext.strokeStyle = "#FFF";

                this.canvasContext.strokeRect(
                    posY,
                    offY,
                    sizeY,
                    note.Block.width * this.ivoryKeyWidth);

            } else {
                this.canvasContext.fillStyle = note.Block.color;

                this.canvasContext.fillRect(
                    posY,
                    this.canvasHeight - note.Block.left * this.ivoryKeyWidth - note.Block.width * this.ivoryKeyWidth,
                    sizeY,
                    note.Block.width * this.ivoryKeyWidth
                );

                this.canvasContext.strokeStyle = "#FFF";

                this.canvasContext.strokeRect(
                    posY,
                    this.canvasHeight - note.Block.left * this.ivoryKeyWidth - note.Block.width * this.ivoryKeyWidth,
                    sizeY,
                    note.Block.width * this.ivoryKeyWidth);
            }
            this.canvasContext.globalAlpha = 1;
        }
        
    };

    render() {
        this.state.selection = this.props.selection;
        return (
            <div className="PianoRollRenderer" ref={(c) => this.container = c} >
                <canvas ref={(c) => this.canvas = c } />
            </div>
        );
    }
} 

export default PianoRoll;