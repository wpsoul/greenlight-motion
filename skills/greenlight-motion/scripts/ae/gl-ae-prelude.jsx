// GreenLight — safe ExtendScript prelude for agent-written After Effects scripts.
//
// Loaded automatically by scripts/ae/gl-ae-run.sh before your script. It defines one global, GL:
//
//   GL.run('Build my comp', function () { ...your code... });   // dialogs suppressed, undo group, errors logged
//   GL.log('anything', 42, err, file, [1, 2]);                   // safe: every value goes through GL.str()
//   GL.str(value)                                                // Error/File/Array/object -> plain string
//   GL.newOwnProject('My Folder')                                // fresh project; refuses to touch the user's work
//   GL.setKeys(prop, [[t, v], ...], [[x1, y1, x2, y2] | 'linear' | 'hold', ...])  // CSS cubic-bezier keyframes
//   GL.hex('#ae3347') -> [r, g, b]      GL.hex4('#ae3347') -> [r, g, b, 1]
//   GL.findComp(name)  GL.findItem(name)
//
// Why: DoScript/DoScriptFile never return a value, and any uncaught error opens a modal
// "Unable to execute script at line N" alert that blocks the user's AE and every later script.
// The most common trigger is joining a non-string into a string ('x' + err, 'x' + file,
// 'x' + prop.keyValue(1)), which raises "Object of type … found where a Number, Array, or
// Property is needed" / "invalid numeric result (divide by zero?)" — often inside a catch
// block, so the original error is lost too. Always log through GL.log / GL.str.

var GL = (function () {
  var logPath = (typeof GL_LOG_PATH !== 'undefined') ? GL_LOG_PATH : (Folder.temp.fsName + '/gl-ae.log');

  function str(v) {
    try {
      if (v === null) return 'null';
      if (v === undefined) return 'undefined';
      var t = typeof v;
      if (t === 'string') return v;
      if (t === 'number' || t === 'boolean') return String(v);
      if (v instanceof Error) return String(v.name) + ': ' + String(v.message) + (v.line !== undefined ? ' (line ' + String(v.line) + ')' : '');
      if (v instanceof File || v instanceof Folder) return String(v.fsName);
      if (v instanceof Array) { var parts = []; for (var i = 0; i < v.length; i++) parts.push(str(v[i])); return '[' + parts.join(', ') + ']'; }
      if (v.name !== undefined && v.typeName !== undefined) return String(v.typeName) + ' "' + String(v.name) + '"';
      return String(v.toString());
    } catch (e) {
      return '<unprintable>';
    }
  }

  function log() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) parts.push(str(arguments[i]));
    try {
      var f = new File(logPath);
      f.encoding = 'UTF-8'; f.lineFeed = 'Unix';
      f.open('a'); f.writeln(parts.join(' ')); f.close();   // open/close per line: survives an abort
    } catch (e) {}
  }

  function run(label, fn) {
    var undo = false;
    try { app.beginSuppressDialogs(); } catch (e0) {}
    try {
      app.beginUndoGroup(label); undo = true;
      fn();
    } catch (e) {
      log('ERROR', e);
    }
    if (undo) { try { app.endUndoGroup(); } catch (e1) {} }
    try { app.endSuppressDialogs(false); } catch (e2) {}
  }

  function findItem(name, type) {
    for (var i = 1; i <= app.project.numItems; i++) {
      var it = app.project.item(i);
      if (it.name === name && (!type || it instanceof type)) return it;
    }
    return null;
  }
  function findComp(name) { return findItem(name, CompItem); }

  // Start a fresh project for an agent build. Closes the current project only when it is
  // clearly ours (contains a folder named `marker`); an untouched empty project is reused.
  // Anything else is the user's work: throw instead of closing it or triggering AE's
  // "Save changes?" modal (beginSuppressDialogs does not cover that one).
  function newOwnProject(marker) {
    var p = app.project;
    var empty = !p.file && p.numItems === 0;
    if (empty) return p;
    if (findItem(marker, FolderItem)) {
      p.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      app.newProject();
      return app.project;
    }
    throw new Error('Another project is open in After Effects (' + (p.file ? String(p.file.name) : 'Untitled') + '). Ask the user to save and close it first.');
  }

  function hex(h) { h = String(h).replace('#', ''); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
  function hex4(h) { var c = hex(h); return [c[0], c[1], c[2], 1]; }

  function clampInfluence(v) { return Math.max(0.1, Math.min(100, v)); }

  // Keyframes with CSS timing. keys: [[time, value], ...]; segs[i] describes key i -> i+1:
  // 'linear', 'hold', or a CSS cubic-bezier [x1, y1, x2, y2] (overshoot allowed). The
  // conversion is exact for 1D, spatial and multi-dimensional properties:
  //   out: influence = x1*100, speed = avg * y1/x1;  in: influence = (1-x2)*100, speed = avg * (1-y2)/(1-x2)
  function setKeys(prop, keys, segs) {
    var i, L = KeyframeInterpolationType.LINEAR, B = KeyframeInterpolationType.BEZIER, H = KeyframeInterpolationType.HOLD;
    for (i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], keys[i][1]);
    var first = prop.nearestKeyIndex(keys[0][0]);
    for (i = 0; i < keys.length; i++) prop.setInterpolationTypeAtKey(first + i, L, L);
    // Decide 'spatial' from the value type, NOT prop.isSpatial: colour properties report
    // isSpatial === true, and setSpatialTangentsAtKey then throws on them.
    var vt = prop.propertyValueType;
    var spatial = (vt === PropertyValueType.TwoD_SPATIAL || vt === PropertyValueType.ThreeD_SPATIAL);
    if (spatial) {
      for (i = 0; i < keys.length; i++) {
        var z = [], n = prop.keyValue(first + i).length; for (var d0 = 0; d0 < n; d0++) z.push(0);
        prop.setSpatialTangentsAtKey(first + i, z, z);
      }
    }
    for (var s = 0; s < keys.length - 1; s++) {
      var seg = segs[s], k1 = first + s, k2 = first + s + 1;
      if (seg === 'linear' || seg === undefined) continue;
      if (seg === 'hold') { prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), H); continue; }
      var T = keys[s + 1][0] - keys[s][0];
      var v1 = prop.keyValue(k1), v2 = prop.keyValue(k2);
      var inflOut = clampInfluence(seg[0] * 100), inflIn = clampInfluence((1 - seg[2]) * 100);
      var ro = seg[0] > 1e-4 ? seg[1] / seg[0] : 0;
      var ri = (1 - seg[2]) > 1e-4 ? (1 - seg[3]) / (1 - seg[2]) : 0;
      var outE = [], inE = [];
      if (spatial) {
        var dd = 0; for (var q = 0; q < v1.length; q++) dd += (v2[q] - v1[q]) * (v2[q] - v1[q]);
        var avg = Math.sqrt(dd) / T;                      // spatial speed is a magnitude
        outE = [new KeyframeEase(avg * ro, inflOut)]; inE = [new KeyframeEase(avg * ri, inflIn)];
      } else if (!(v1 instanceof Array)) {
        var a1 = (v2 - v1) / T;                           // 1D speed is signed
        outE = [new KeyframeEase(a1 * ro, inflOut)]; inE = [new KeyframeEase(a1 * ri, inflIn)];
      } else {
        var dims = prop.keyInTemporalEase(k1).length;     // e.g. Scale -> 3
        for (var d = 0; d < dims; d++) {
          var ad = (v2[d] - v1[d]) / T;
          outE.push(new KeyframeEase(ad * ro, inflOut)); inE.push(new KeyframeEase(ad * ri, inflIn));
        }
      }
      prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), B);
      prop.setInterpolationTypeAtKey(k2, B, prop.keyOutInterpolationType(k2));
      prop.setTemporalEaseAtKey(k1, prop.keyInTemporalEase(k1), outE);
      prop.setTemporalEaseAtKey(k2, inE, prop.keyOutTemporalEase(k2));
    }
  }

  return { str: str, log: log, run: run, findItem: findItem, findComp: findComp, newOwnProject: newOwnProject, hex: hex, hex4: hex4, setKeys: setKeys, logPath: logPath };
})();
