import React, { Component } from 'react';
import './App.css';
import AudioController from './audiocontroller'

import Modal from 'react-responsive-modal'
import LocalizedStrings from 'react-localization';
import FontAwesome from 'react-fontawesome'

import Progress from 'react-progressbar'

import Data from './songs/hanschen.js'

import PianoRoll from './PianoRoll'

import Cookies from 'universal-cookie';
const cookies = new Cookies();

const note_labels_flat = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const note_labels_sharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

 
let strings = new LocalizedStrings({
 en:{
   title:"Whistling for Dummies",
   destNote:"Hit this tone",
   curNote:"What you whistle",
   description:"Whistle along this melody and beat your high score",
   gameover:"Challenge Completed"
 },
 de: {
   title:"Pfeifen für Pfeifen",
   destNote:"Triff diesen Ton",
   curNote:"Diesen Ton pfeifst du",
   description:"Pfeife diese Melodie und schlage deinen Highscore",
   gameover:"Gut gemacht!"
 }
});

class Play extends Component {

  constructor() {
    super();
    this.state = {
      note: 0, 
      updown: 0, 
      destNote: 0,
      progress: 0,
      gameover: false,
      score: 0
    };
  }

  higherOrLower (note) {
    if(note === this.state.destNote) 
        return 0;

    var nextNote = note;
    if(Math.abs(note - this.state.destNote) < Math.abs((12 + note) - this.state.destNote) % 12)
        nextNote = 12 + note;
    
    return this.state.destNote < nextNote ? -1 : 1;
  }

  componentDidMount() {
    this.audiocontroller = new AudioController();    
	  this.audiocontroller.onFrame = (note) => { 
      if(this.state.gameover)
        return;
      
      this.pianoroll.note = note;  
      if(note != null) {    
        this.setState({
          note: note, 
          updown: this.higherOrLower(note)
        });
      }
    };
    
    this.startTime = Date.now();
  }

  isFlatOrSharpKey(key) {
    var flatOrSharp = [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1,
                        0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];
    return (flatOrSharp[key % 24] > 0);
  }

  getNoteLabel(midi) {
    if(midi >= 0) {
      if (!this.isFlatOrSharpKey(Data.MusicInfo.Key)) {
        return note_labels_flat[midi % 12] 
      } else {
        return note_labels_sharp[midi % 12] 
      }
    }
    return "";
  }

  onComplete() {
    var score = Math.round((Date.now() - this.startTime) / 1000);
    
    if(cookies.get('highscore') == undefined || score < cookies.get('highscore')) {
      cookies.set('highscore', score, { path: '/' });
    }

    this.setState({
      score: score,
      gameover: true
    });
  }

  onCloseModal(){
    this.startTime = Date.now();
    this.pianoroll.time = 0;
    this.setState({
      gameover: false
    });
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
            <p className="App-intro">
              <span style={{left: "10px", position: "absolute"}}>
                {this.getNoteLabel(this.state.destNote) + " "}
              </span>
              <span style={{fontSize: "0.8em"}}>
                {strings.title}
              </span>
              <span style={{right: "10px", position: "absolute"}}>
                {this.getNoteLabel(this.state.note) + " "} 
                {
                  this.state.updown < 0 ?
                  <FontAwesome
                    name='arrow-down'
                    style={{ textShadow: '0 1px 0 rgba(0, 0, 0, 0.1)' }}
                  /> : this.state.updown > 0 ? 
                  <FontAwesome
                    name='arrow-up'
                    style={{ textShadow: '0 1px 0 rgba(0, 0, 0, 0.1)' }}
                  /> : 
                  <FontAwesome
                    name='thumbs-up'
                    style={{ textShadow: '0 1px 0 rgba(0, 0, 0, 0.1)' }}
                  />
                }
              </span>
            </p>
        </header> 
        <PianoRoll 
          ref={(c) => this.pianoroll = c}
          musicVo={Data}
          onFinish={() => {this.onComplete()}}
          onUpdate={(progress, destNote) => {this.setState({progress: progress, destNote: destNote % 12})}}
         />     
        <Progress ref={(c) => this.progressBar = c} completed={this.state.progress} color = "#2D5D7B" /> 
        <div className="Tutorial">
          <p className="TutorialDestTone">&uarr; {strings.destNote}</p>
          <p className="TutorialCurTone">{strings.curNote} &uarr;</p>
          <p className="TutorialDescription">{strings.description}</p>
        </div>
        <Modal open={this.state.gameover} onClose={() => {this.onCloseModal()}} little>
          <h2>{strings.gameover}</h2>
          <p>
            Score: {this.state.score} seconds
          </p>
          {cookies.get('highscore') ? (
            <p>High Score: {cookies.get('highscore')} seconds</p>
          ) : null}
        </Modal> 
      </div>
    );
  }
}

export default Play;
