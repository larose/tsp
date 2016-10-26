importScripts('lib.js');

class ElasticNet {
  constructor(cities, params) {
    this._params = params;
    this._cities = cities;
    this._numCities = this._cities.length;
    this._k = params.initialK;
    this._gaussianExpDenominator = -2 * pow2(this._k);
    this._numIter = 0;
    this._initPoints();
    this._numPoints = this._points.length;
    this._distForce = new Array(this._numPoints);
    this._lengthForce = new Array(this._numPoints);

    this._deltas = new Array(this._numCities);
    this._dist2 = new Array(this._numCities);
    this._weights = new Array(this._numCities);
    for (let i = 0; i < this._numCities; i++) {
      this._deltas[i] = new Array(this._numPoints);
      this._dist2[i] = new Array(this._numPoints);
      this._weights[i] = new Array(this._numPoints);
    }
  }

  do_iteration () {
    this._numIter++;

    this._updateK();
    this._updateDeltas();
    this._updateDist2();
    this._updateWorstDist();
    this._updateWeights();
    this._updatePoints();

    return this._done();
  }

  solution () {
    return this._points;
  }

  _centroid() {
    var x = this._cities.map(n => n.x).reduce((prev, cur) => prev + cur, 0) / this._numCities;
    var y = this._cities.map(n => n.y).reduce((prev, cur) => prev + cur, 0) / this._numCities;

    return new Point(x, y);
  }

  // Computes the force that minimize the distance between the cities
  // and the points.
  _updateDistForce() {
    let weights = new Array(this._numCities);
    let deltas = new Array(this._numCities);
    for (let j = 0; j < this._numPoints; j++) {

      for (let i = 0; i < this._numCities; i++) {
        weights[i] = this._weights[i][j];
        deltas[i] = this._deltas[i][j];
      }

      let sumX = 0;
      let sumY = 0;

      for (let k = 0; k < weights.length; k++) {
        sumX += weights[k] * deltas[k].x;
        sumY += weights[k] * deltas[k].y;
      }

      this._distForce[j] = new Point(sumX, sumY);
    }
  }

  _initPoints() {
    let thetas = Array.from(linspace(0, 2 * Math.PI, this._params.numPointsFactor * this._numCities));
    let centroid = this._centroid();

    this._points = thetas.map(theta => new Point(Math.cos(theta) * this._params.radius + centroid.x, Math.sin(theta) * this._params.radius + centroid.y));
  }

  _done () {
    return this._worstDist < this._params.epsilon || this._numIter > this._params.maxNumIter;
  }

  // Computes the force that minimize the length of the elastic.
  _updateLengthForce () {
    for (let j = 0; j < this._numPoints; j++) {
      let prevIndex = (j - 1) % this._numPoints;
      if (prevIndex < 0) {
        prevIndex += this._numPoints;
      }
      let prev = this._points[prevIndex];
      let next = this._points[(j + 1) % this._numPoints];
      let current = this._points[j];

      this._lengthForce[j] = new Point(prev.x + next.x - 2 * current.x,
                                       prev.y + next.y - 2 * current.y);
    }
  }

  _updateDeltas () {
    for (let i = 0; i < this._numCities; i++) {
      for (let j = 0; j < this._numPoints; j++) {
        this._deltas[i][j] = new Point(this._cities[i].x - this._points[j].x,
                                       this._cities[i].y - this._points[j].y);
      }
    }
  }

  _updateDist2 () {
    for (let i = 0; i < this._numCities; i++) {
      for (let j = 0; j < this._numPoints; j++) {
        this._dist2[i][j] = pow2(this._deltas[i][j].x) + pow2(this._deltas[i][j].y);
      }
    }
  }

  _updateK () {
    if ((this._numIter % this._params.kUpdatePeriod) === 0) {
      this._k = Math.max(0.01, this._params.kAlpha * this._k);
      this._gaussianExpDenominator = -2 * pow2(this._k);
    }
  }

  _updatePoints() {
    this._updateDistForce();
    this._updateLengthForce();

    for (let j = 0; j < this._numPoints; j++) {
      this._points[j] = new Point(
        this._points[j].x + this._params.alpha * this._distForce[j].x  + this._params.beta * this._k * this._lengthForce[j].x,
        this._points[j].y + this._params.alpha * this._distForce[j].y  + this._params.beta * this._k * this._lengthForce[j].y
      );
    }
  }

  _updateWeights () {
    // Unormalized weights
    for (let i = 0; i < this._numCities; i++) {
      for (let j = 0; j < this._numPoints; j++) {
        this._weights[i][j] = Math.exp(this._dist2[i][j] / this._gaussianExpDenominator);
      }
    }

    // Normalized weights
    for (let i = 0; i < this._numCities; i++) {
      let sumOverPoints = 0;
      for (let j = 0; j < this._numPoints; j++) {
        sumOverPoints += this._weights[i][j];
      }

      for (let j = 0; j < this._numPoints; j++) {
        this._weights[i][j] /= sumOverPoints;
      }
    }
  }

  _updateWorstDist () {
    this._worstDist = 0;
    for (let i = 0; i < this._numCities; i++) {
      let closestNeuronForNode = Infinity;
      for (let j = 0; j < this._numPoints; j++) {
        if (this._dist2[i][j] < closestNeuronForNode) {
          closestNeuronForNode = this._dist2[i][j];
        }
      }

      if (closestNeuronForNode > this._worstDist) {
        this._worstDist = closestNeuronForNode;
      }
    }

    this._worstDist = Math.sqrt(this._worstDist);
  }
}

class W {

  constructor (postMessage) {
    this._postMessage = postMessage;
  }

  create (cities, params) {
    clearTimeout(this._timeout);

    this._algo = new ElasticNet(cities, params);
    this._postMessage({
      name: 'created',
      args: [this._algo._cities, this._algo.solution()]
    });
  }

  getSolution () {
    this._postMessage({
      name: 'solution',
      args: [this._algo.solution()]
    });
  }

  setParam (name, value) {
    this._algo._params[name] = value;
  }

  start() {
    this._timeout = setTimeout(this._run.bind(this), 0);
    this._postMessage({
      name: 'started'
    });
  }

  stop () {
    clearTimeout(this._timeout);
    this._postMessage({
      name: 'stopped'
    });
  }

  _run () {
    let count = 0;
    let done = false;

    while (!done && count < 5) {
      done = this._algo.do_iteration();
      count++;
    }

    if (done) {
      this.stop();
    } else {
      this._timeout = setTimeout(this._run.bind(this), 0);
    }
  }
}

function* linspace (start, end, num) {
  let delta = end - start;
  let step = delta / num;

  let previous = start;
  for (let i = 0; i < num; i++) {
    yield previous;
    previous += step;
  }
}

function pow2 (number) {
  return number * number;
}

let worker = new W(postMessage.bind(this));

onmessage = function(event) {
  let data = event.data;

  worker[data.name].apply(worker, data.args);
};
