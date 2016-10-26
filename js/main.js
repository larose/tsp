class Algo {
  constructor (transport) {
    this._transport = transport;
  }

  create (nodes, params) {
    this._transport.postMessage('create', [nodes, params]);
  }

  getSolution () {
    this._transport.postMessage('getSolution');
  }

  removeOnSolution(listener) {
    this._transport.removeListener('solution', listener);
  }

  setParam(name, value) {
    this._transport.postMessage('setParam', [name, value]);
  }

  start (nodes, params) {
    this._transport.postMessage('start');
  }

  stop (nodes, params) {
    this._transport.postMessage('stop');
  }

  onCreated (listener) {
    this._transport.on('created', listener);
  }

  onDone (listener) {
    this._transport.on('done', listener);
  }

  onSolution (listener) {
    this._transport.on('solution', listener);
  }

  onStarted (listener) {
    this._transport.on('started', listener);
  }

  onStopped (listener) {
    this._transport.on('stopped', listener);
  }
}

class TSPMap {
  constructor(canvas) {
    this._canvas = canvas;
    this._context = canvas[0].getContext('2d');
    this.setCities([]);
    this.setPoints([]);
  }

  draw () {
    let width = $(canvas).width();
    let height = $(canvas).height();
    let scaledCities = this._scaled(this._cities);
    let scaledPoints = this._scaled(this._points);

    this._context.clearRect(0, 0, width, height);
    draw_nodes(this._context, scaledCities, 4, true);
    draw_nodes(this._context, scaledPoints, 3, false);
    draw_edges(this._context, scaledPoints);
  }

  setCities (cities) {
    this._cities = cities;
  }

  setPoints (points) {
    this._points = points;
  }

  _scaled (points) {
    let width = $(canvas).width();
    let height = $(canvas).height();
    return points.map(node => new Point(node.x * width, node.y * height));
  }
}

class WorkerTransport {
  constructor (worker) {
    this._worker = worker;
    this._listeners = new Map();
    this._worker.onmessage = this._onmessage.bind(this);
  }

  on (eventName, listener) {
    let listeners = this._listeners.get(eventName);
    if (typeof listeners === 'undefined') {
      listeners = new Set();
      this._listeners.set(eventName, listeners);
    }

    listeners.add(listener);
  }

  postMessage(name, args) {
    this._worker.postMessage({
      name: name,
      args: args
    });
  }

  removeListener (eventName, listener) {
    let listeners = this._listeners.get(eventName);
    if (typeof listeners === 'undefined') {
      return;
    }

    listeners.delete(listener);
  }

  _onmessage (event) {
    let listeners = this._listeners.get(event.data.name);
    if (typeof listeners !== 'undefined') {
      listeners.forEach(l => l.apply(null, event.data.args));
    }
  }
}

function draw_edges (context, nodes) {
  if (nodes.length === 0) {
    return;
  }

  context.strokeStyle = '#f00';
  context.lineWidth = 2;
  context.beginPath();

  context.moveTo(nodes[0].x, nodes[0].y);
  nodes.slice(1).forEach(function (node) {
    context.lineTo(node.x, node.y);
  });
  context.lineTo(nodes[0].x, nodes[0].y);

  context.stroke();
  context.closePath();
}

function draw_nodes (context, nodes, radius, fill) {
  context.strokeStyle = '#444';
  nodes.forEach(node => {
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2, true);
    context.closePath();
    if (fill) {
      context.fill();
    } else {
      context.stroke();
    }
  });
}

function updateCanvasSize (canvas) {
  let width = canvas.parent().width();
  let height = 0.75 * window.innerHeight;

  let length = Math.min(width, height);

  canvas[0].width = length;
  canvas[0].height = length;
}

function updateInputRange (inputRange, canvas) {
  inputRange.width(canvas.width());
}

function onResize (canvas, inputRange, map) {
  updateCanvasSize(canvas);
  updateInputRange(inputRange, canvas);
  map.draw();
}

let PARAMS = ['alpha', 'beta'];

$(function () {
  let canvas = $('#canvas');
  let inputRange = $("#solutions-range");
  let startStopButton = $("#start-stop");

  let cities = [];
  for (let i = 0; i < $("input[name='cities']").val(); i++) {
    cities.push(new Point(Math.random(), Math.random()));
  }

  let params = {
    alpha: Number($("input[name='alpha']").val()),
    beta: Number($("input[name='beta']").val()),
    initialK: 0.2,
    epsilon: 0.02,
    kAlpha: 0.99,
    kUpdatePeriod: 25,
    maxNumIter: 100000,
    numPointsFactor: 2.5,
    radius: 0.1
  };

  let algo = new Algo(new WorkerTransport(new Worker('js/worker.js')));
  let map = new TSPMap(canvas);
  let solutions = [];
  let started = false;

  $(window).resize(onResize.bind(null, canvas, inputRange, map));
  onResize(canvas, inputRange, map);

  algo.onStopped(function () {
    started = false;
    startStopButton.text('Start');
  });

  startStopButton.click(function (event) {
    event.preventDefault();
    if (started) {
      algo.stop();
    } else {
      algo.start();
    }
  });

  inputRange.on('input change', function () {
    let value = inputRange.val();
    map.setPoints(solutions[value - 1]);
    map.draw();
  });

  algo.onCreated(function (cities, solution) {
    solutions = [solution];
    inputRange.attr('max', solutions.length);
    inputRange.val(solutions.length);
    map.setCities(cities);
    map.setPoints(solution);
    map.draw();
  });

  algo.onStarted(function () {
    started = true;
    startStopButton.text('Stop');
    algo.getSolution();
  });

  algo.onSolution(function (points) {
    solutions.push(points);
    inputRange.attr('max', solutions.length);
    inputRange.val(solutions.length);
  });

  algo.onSolution(function (points) {
    let width = $(canvas).width();
    let height = $(canvas).height();

    map.setPoints(points);
    map.draw();

    if (started) {
      setTimeout(function () {
        algo.getSolution();
      }, 30);
    }
  });

  $("input[name='cities']").on('input change', function (event) {
    algo.stop();
    let target = $(event.target);
    let value = target.val();

    let cities = [];
    for (let i = 0; i < value; i++) {
      cities.push(new Point(Math.random(), Math.random()));
    }

    algo.create(cities, params);
  });

  PARAMS.forEach(function(paramName) {
    let input = $("input[name='" + paramName + "']");

    input.on('input change', function (event) {
      let target = $(event.target);
      let value = Number(target.val());
      params[target.attr('name')] = value;
      algo.setParam(target.attr('name'), value);
    });
  });

  map.setCities(cities);
  map.draw();
  algo.create(cities, params);
});
