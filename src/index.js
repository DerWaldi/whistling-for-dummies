import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import registerServiceWorker from './registerServiceWorker';
import Play from './Play'; 

ReactDOM.render(<Play />, document.getElementById('root'));
registerServiceWorker();
