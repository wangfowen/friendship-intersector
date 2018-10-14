class Timeline {
  constructor() {
    this.first = {
      data: [],
      init: undefined,
      prevPoint: undefined,
      currPoint: undefined,
      currIdx: 0
    };
    this.second = {
      data: [],
      init: undefined,
      prevPoint: undefined,
      currPoint: undefined,
      currIdx: 0
    };
    this.processedData = [];
    this.days = [];

    this.options = {
      segments: 4,
      boundChangeAfter: 5,
      minutesGrouping: 5,
      closenessKm: 0.5
    };

    this.line;

    this.controlsId;
    this.timelineId;
    this.viz;
  }

  addData(firstData, secondData) {
    this.first.data = firstData;
    this.second.data = secondData;
    this.processData();
  }

  latlng(data) {
    return [data[1], data[0]];
  }

  time(data) {
    return data[2];
  }

  init(viz, controlsId, timelineId) {
    this.viz = viz;
    this.controlsId = controlsId;
    this.timelineId = timelineId;

    this.populateTimeline();
  }

  populateTimeline() {
    const ref = this;
    const $timeline = $(ref.timelineId);

    ref.days.forEach((data, i) => {
      if (data.date !== undefined) {
        $timeline.append(`<div style="top:8%;left:${data.left}px">${data.date}</div>`);
      }

      if (data.first !== undefined) {
        $timeline.append(`<span data-day="${i}" data-left="${data.left}" data-index="${data.index}" style="top:30%;background:#F87531;left:${data.left}px"></span>`);
      }
      if (data.second !== undefined) {
        $timeline.append(`<span data-day="${i}" data-left="${data.left}" data-index="${data.index}" style="top:60%;background:#00BFFF;left:${data.left}px"></span>`);
      }

      if (data.intersection) {
        $timeline.append(`<hr width="1" size="150" style="left: ${data.left + 4}px;background:red">`);
      }
    });

    const $spans = $(`${ref.timelineId} span`);
    $spans.click((e) => {
      const index = parseInt($(e.target).attr("data-index"), 10);
      const dayCounter = parseInt($(e.target).attr("data-day"), 10);
      ref.viz.progress = index;
      ref.viz.repaintLine(dayCounter + 1);
    });

    $timeline.width($spans.last().offset().left + 30);
  }

  initLine() {
    const line = {
      "type": "FeatureCollection",
      "features": [{
        "type": "Feature",
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [0, 0],
            [0, 0]
          ]
        }
      }]
    };

    this.line = line;
  }

  //first valid point on both lines, time is earliest one of both, bound encompasses just the points
  getInitData() {
    const first = this.first.init;
    const second = this.second.init;
    const firstBounds = this.calculateBounds([first]);
    const secondBounds = this.calculateBounds([second]);
    const bothBounds = this.calculateBounds([first, second]);
    const time = this.getData(0).time;

    return this.dataObj(first, second, firstBounds, secondBounds, bothBounds, time);
  }

  getData(time) {
    return this.processedData[time];
  }

  newTime(firstData, secondData) {
    if (firstData && secondData) {
      return Math.min(this.time(firstData), this.time(secondData))
    } else if (firstData) {
      return this.time(firstData);
    } else {
      return this.time(secondData);
    }
  }

  setPoint(set, time, ms) {
    const ref = this;
    if (set.data[set.currIdx] && time + ms >= ref.time(set.data[set.currIdx])) {
      set.prevPoint = set.currPoint;
      set.currPoint = ref.latlng(set.data[set.currIdx]);
      set.currIdx += 1;

      if (set.init === undefined) {
        set.init = set.currPoint;
      }

      if (set.prevPoint === undefined) {
        return [];
      } else {
        return ref.segmentLine(set.prevPoint, set.currPoint);
      }
    } else {
      set.currPoint = undefined;
      return [];
    }
  }

  processData() {
    const ref = this;
    ref.initLine();

    let time = ref.newTime(ref.first.data[0], ref.second.data[0]);
    const ms = ref.options.minutesGrouping * 60 * 1000;

    let day = parseInt(moment(time).format("YYDDD"), 10);
    let dayCounter = 0;
    let intersectSinceLast = false;
    let firstDayPoint = undefined;
    let secondDayPoint = undefined;

    let boundCounter = 0;
    let firstBounds;
    let secondBounds;
    let bothBounds;

    while (ref.first.currIdx < ref.first.data.length - 1 ||
           ref.second.currIdx < ref.second.data.length - 1) {
      //set a new bound
      if (boundCounter === 0) {
        let firstLook = [];
        let secondLook = [];

        for (let i = -1 * ref.options.boundChangeAfter; i < ref.options.boundChangeAfter; i++) {
          const firstData = ref.first.data[ref.first.currIdx + i];
          const secondData = ref.second.data[ref.second.currIdx + i];

          if (firstData && time + ms >= ref.time(firstData)) {
            firstLook.push(ref.latlng(firstData));
          }

          if (secondData && time + ms >= ref.time(secondData)) {
            secondLook.push(ref.latlng(secondData));
          }
        }

        if (firstLook.length > 0) {
          firstBounds = ref.calculateBounds(firstLook);
        }
        if (secondLook.length > 0) {
          secondBounds = ref.calculateBounds(secondLook);
        }
        if (firstBounds === undefined) {
          firstBounds = secondBounds;
        }
        if (secondBounds === undefined) {
          secondBounds = firstBounds;
        }
        if (firstLook.length > 0 || secondLook.length > 0) {
          bothBounds = ref.calculateBounds(firstLook.concat(secondLook));
        }
      }
      boundCounter = (boundCounter + 1) % ref.options.boundChangeAfter;

      const firstSegments = ref.setPoint(ref.first, time, ms);
      const secondSegments = ref.setPoint(ref.second, time, ms);

      const count = Math.max(firstSegments.length, secondSegments.length);
      for (let i = 0; i < count; i++) {
        const firstPoint = firstSegments[i];
        const secondPoint = secondSegments[i];
        const currIntersecting = ref.didIntersect(firstPoint, secondPoint);
        intersectSinceLast = intersectSinceLast || currIntersecting;

        ref.processedData.push(ref.dataObj(
          firstPoint,
          secondPoint,
          firstBounds,
          secondBounds,
          bothBounds,
          time,
          currIntersecting
        ));
      }

      //new day to add to actual timeline gui
      if (firstDayPoint === undefined) {
        firstDayPoint = firstSegments[0];
      }
      if (secondDayPoint === undefined) {
        secondDayPoint = secondSegments[0];
      }
      const newDay = parseInt(moment(time).format("YYDDD"), 10);
      if (newDay > day) {
        dayCounter += 1;
        let date = undefined;
        if (moment(time).format("D") === "1") {
          date = moment(time).format("MMM YY");
        }

        ref.processedData[ref.processedData.length - 1].dayCounter = dayCounter;
        ref.days.push(ref.daysObj(dayCounter, ref.processedData.length, firstDayPoint, secondDayPoint, intersectSinceLast, date));

        //reset for next day
        day = newDay;
        intersectSinceLast = false;
        firstDayPoint = undefined;
        secondDayPoint = undefined;
      }

      time = ref.newTime(ref.first.data[ref.first.currIdx], ref.second.data[ref.second.currIdx]);
    }
  }

  didIntersect(firstData, secondData) {
    if (firstData === undefined || secondData === undefined) {
      return false;
    }

    const ref = this;
    const line = ref.line;
    const startCoord = ref.latlng(firstData);
    const endCoord = ref.latlng(secondData);
    line.features[0].geometry.coordinates = [startCoord, endCoord];

    return turf.lineDistance(line.features[0], 'kilometers') <= this.options.closenessKm;
  }

  dataObj(first, second, firstBounds, secondBounds, bothBounds, time, intersection) {
    return {
      first: first,
      second: second,
      firstBounds: firstBounds,
      secondBounds: secondBounds,
      bothBounds: bothBounds,
      time: time,
      intersection: intersection
    };
  }

  daysObj(dateDiff, index, firstData, secondData, intersection, date) {
    return {
      left: dateDiff * 20,
      first: firstData,
      second: secondData,
      index: index,
      intersection: intersection,
      date: date
    };
  }

  calculateBounds(points) {
    return points.reduce(function(b, coord) {
      return b.extend(coord);
    }, new mapboxgl.LngLatBounds(points[0], points[0]));
  }

  //TODO: does this work correctly if there's less than 4km distance?
  segmentLine(startCoord, endCoord) {
    const ref = this;
    const line = ref.line;
    line.features[0].geometry.coordinates = [startCoord, endCoord];

    const distance = turf.lineDistance(line.features[0], 'kilometers');
    const lineFragments = [];
    for (let i = 0; i < distance; i += distance / ref.options.segments) {
      const fragment = turf.along(line.features[0], i, 'kilometers').geometry.coordinates;
      lineFragments.push(fragment);
    }

    return lineFragments;
  }
}
