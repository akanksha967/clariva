/**
 * main.js
 * Entry point — imports and initialises all page modules.
 */
import { initReveal } from './reveal.js';
import { initTimer  } from './timer.js';
import { initNav    } from './nav.js';
import { initForm   } from './form.js';
import { initVapi   } from './vapi.js';

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initTimer();
  initNav();
  initForm();
  initVapi();
});
