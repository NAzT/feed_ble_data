/*
  Copyright (c) 2010 - 2017, Nordic Semiconductor ASA
  All rights reserved.
  Redistribution and use in source and binary forms, with or without modification,
  are permitted provided that the following conditions are met:
  1. Redistributions of source code must retain the above copyright notice, this
     list of conditions and the following disclaimer.
  2. Redistributions in binary form, except as embedded into a Nordic
     Semiconductor ASA integrated circuit in a product or a software update for
     such product, must reproduce the above copyright notice, this list of
     conditions and the following disclaimer in the documentation and/or other
     materials provided with the distribution.
  3. Neither the name of Nordic Semiconductor ASA nor the names of its
     contributors may be used to endorse or promote products derived from this
     software without specific prior written permission.
  4. This software, with or without modification, must only be used with a
     Nordic Semiconductor ASA integrated circuit.
  5. Any software provided in binary form under this license must not be reverse
     engineered, decompiled, modified and/or disassembled.
  THIS SOFTWARE IS PROVIDED BY NORDIC SEMICONDUCTOR ASA "AS IS" AND ANY EXPRESS
  OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
  OF MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE ARE
  DISCLAIMED. IN NO EVENT SHALL NORDIC SEMICONDUCTOR ASA OR CONTRIBUTORS BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
  HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
  LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
  OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
 
var Thingy = require('../index');

const mqtt = require('cmmc-mqtt').mqtt
const mqttClient1 = mqtt.create('mqtt://cmmc:cmmc@odin.cmmc.io', []).register('on_connected', function () {
  console.log('mqtt connected.')
  Start();
})

var isLoadingFeed = false;
var timeoutForReadData = 10000;
var timeForDiscovery = 8000;

var loadTimeout;
var currentFeedIndex = 0;

var allFeedData = [];

var colorSchema = ["red", "blue", "green", "clear"];
var gasSchema = ["eco2", "tvoc"];
var generalSchema = ["temperature", "pressure", "humidity", "battery"];

function ResetAllFeedData() {
  allFeedData = [];
}

function AddDataType(feed, type, data)
{
  // Use only know data
  if (colorSchema.includes(type))
  {
    feed.color[type] = data;
  }
  else if (gasSchema.includes(type))
  {
    feed.gas[type] = data;
  }
  else if (generalSchema.includes(type))
  {
    feed[type] = data;
  }
}

function NewFeedData(thingy)
{
  var feedData = {};

  feedData.thingy = thingy;

  feedData.color = {};
  feedData.color.red = "";
  feedData.color.green = "";
  feedData.color.blue = "";
  feedData.color.clear = "";

  feedData.battery = "";
  feedData.temperature = "";
  feedData.pressure = "";
  feedData.humidity = "";

  feedData.gas = {};
  feedData.gas.eco2 = "";
  feedData.gas.tvoc = "";

  return feedData;
}

function IsGetAllDataFinish(feed)
{
  var allFiledData = true;

  for (var i = 0; i < colorSchema.length; i++)
  {
    if (feed.color[colorSchema[i]] === "")
    {
      console.log(colorSchema[i] + " is empty " + feed.color[colorSchema[i]]);
      allFiledData = false;
    }
    
  }

  for (var i = 0; i < gasSchema.length; i++)
  {
    if (feed.gas[gasSchema[i]] === "")
    {
      console.log(gasSchema[i] + " is empty " + feed.gas[gasSchema[i]]);
      allFiledData = false;
    }
  }

  for (var i = 0; i < generalSchema.length; i++)
  {
    if (feed[generalSchema[i]] === "")
    {
      console.log(generalSchema[i] + " is empty: " + feed[generalSchema[i]]);
      allFiledData = false;
    }
  }

  return allFiledData;
}

function RemoveAllBadData(feed)
{

  for (var i = 0; i < colorSchema.length; i++)
  {
    if (feed.color[colorSchema[i]] === "")
    {
      console.log(colorSchema[i] + " -> remove");
      delete feed.color;
      break;
    }
    
  }

  for (var i = 0; i < gasSchema.length; i++)
  {
    if (feed.gas[gasSchema[i]] === "")
    {
      console.log(gasSchema[i] + " -> remove");
      delete feed.gas;
      break;
    }

  }

  for (var i = 0; i < generalSchema.length; i++)
  {
    if (feed[generalSchema[i]] === "")
    {
      console.log(generalSchema[i] + " -> remove");
      delete feed.generalSchema[i];
    }
  }

  return feed;
}

function Start ()
{
  console.log('Start Thingy discover all node');

  Thingy.discoverAll(onDiscover);

  setTimeout(function ()
  {
    // console.log('Try stop discover all');
    Thingy.stopDiscoverAll(function() {
      console.log('stopDiscoverAll');
    });

    if (allFeedData.length > 0) 
    {
      var feed = allFeedData[0];
      ConnectThingy(feed, function ()
      {
        console.log('finish callback')

        console.log(allFeedData)

        for (var i = 0; i < allFeedData.length; i++)
        {
          var f = allFeedData[i];

          f.uuid = f.thingy.uuid;
          delete f.thingy;
          f = RemoveAllBadData(f);

          mqttClient1.publish("ble", JSON.stringify(f), {retain: false})

        }

        ResetAllFeedData();
        Start();
      });
    }

    // for (var i = 0; i < allFeedData.length; i++)
    // {
    //   currentFeedIndex = i;
    //   isLoadingFeed = true;



    //   console.log('Try connect ' + thingy.uuid);
      


    // }

    // ResetAllFeedData();
    // console.log('end');

  }, 
  timeForDiscovery);
}

function ConnectThingy(feed, callback)
{
  var thingy = feed.thingy;

  thingy.connectAndSetup(function (error) 
  {
    console.log('thingy connect');
    thingy.on('temperatureNotif', onTemperatureData);
    thingy.on('pressureNotif', onPressureData);
    thingy.on('humidityNotif', onHumidityData);
    thingy.on('gasNotif', onGasData);
    thingy.on('colorNotif', onColorData);
    thingy.on('batteryLevelChange', onBatteryLevelChange);

    thingy.temperature_interval_set(timeoutForReadData, function(error) {
        if (error) {
            console.log('Temperature sensor configure! ' + error);
        }
    });
    thingy.pressure_interval_set(timeoutForReadData, function(error) {
        if (error) {
            console.log('Pressure sensor configure! ' + error);
        }
    });
    thingy.humidity_interval_set(timeoutForReadData, function(error) {
        if (error) {
            console.log('Humidity sensor configure! ' + error);
        }
    });
    thingy.color_interval_set(timeoutForReadData, function(error) {
        if (error) {
            console.log('Color sensor configure! ' + error);
        }
    });
    thingy.gas_mode_set(1, function(error) {
        if (error) {
            console.log('Gas sensor configure! ' + error);
        }
    });

    enabled = true;

    thingy.temperature_enable(function(error) {
        console.log('Temperature sensor started! ' + ((error) ? error : ''));
    });
    thingy.pressure_enable(function(error) {
        console.log('Pressure sensor started! ' + ((error) ? error : ''));
    });
    thingy.humidity_enable(function(error) {
        console.log('Humidity sensor started! ' + ((error) ? error : ''));
    });
    thingy.color_enable(function(error) {
        console.log('Color sensor started! ' + ((error) ? error : ''));
    });
    thingy.gas_enable(function(error) {
        console.log('Gas sensor started! ' + ((error) ? error : ''));
    });
    thingy.notifyBatteryLevel(function(error) {
      console.log('Battery Level Notifications enabled! ' + ((error) ? error : ''));
    });

    loadTimeout = setTimeout(function()
    { 
      
      isLoadingFeed = false;


      thingy.disconnect();

      if (IsGetAllDataFinish(feed))
      {
        // load complete
        console.log("Finish uuid: " + thingy.uuid + " with data");
        // console.log(feed);
      }
      else
      {
        console.log("Failed uuid: " + thingy.uuid + " with data");
        console.log(feed);
        // load failed remove this thingy
      }


      currentFeedIndex++;

      if (currentFeedIndex == allFeedData.length)
      {
        console.log("Finish Read All");
          if (callback)
          {
            callback();
          }
      }
      else 
      {
        if (callback)
        {
          ConnectThingy(allFeedData[currentFeedIndex], callback);
        }
        else 
        {
          ConnectThingy(allFeedData[currentFeedIndex]);  
        }
      }

    }
    , timeoutForReadData);
  });
}


function onTemperatureData(temperature) {
    console.log('Temperature sensor: ' + temperature + " uuid:" + allFeedData[currentFeedIndex].thingy.uuid);
    AddDataType(allFeedData[currentFeedIndex], "temperature", temperature);
}

function onPressureData(pressure) {
    console.log('Pressure sensor: ' + pressure + " uuid:" + allFeedData[currentFeedIndex].thingy.uuid);
    AddDataType(allFeedData[currentFeedIndex], "pressure", pressure);
}

function onHumidityData(humidity) {
    console.log('Humidity sensor: ' + humidity + " uuid:" + allFeedData[currentFeedIndex].thingy.uuid);
    AddDataType(allFeedData[currentFeedIndex], "humidity", humidity);
}

function onGasData(gas) {
    console.log('Gas sensor: eCO2 ' + gas.eco2 + ' - TVOC ' + gas.tvoc  + " uuid:" + allFeedData[currentFeedIndex].thingy.uuid);
    AddDataType(allFeedData[currentFeedIndex], "eco2", gas.eco2);
    AddDataType(allFeedData[currentFeedIndex], "tvoc", gas.tvoc);

}

function onColorData(color) {
    console.log('Color sensor: r ' + color.red +
                             ' g ' + color.green +
                             ' b ' + color.blue +
                             ' c ' + color.clear + " uuid:" + allFeedData[currentFeedIndex].thingy.uuid);

    AddDataType(allFeedData[currentFeedIndex], "red", color.red);
    AddDataType(allFeedData[currentFeedIndex], "green", color.green);
    AddDataType(allFeedData[currentFeedIndex], "blue", color.blue);
    AddDataType(allFeedData[currentFeedIndex], "clear", color.clear);
}

function onBatteryLevelChange(level) {
    console.log('Battery level: ' + level + '%'  + " uuid:" + allFeedData[currentFeedIndex].thingy.uuid);
    AddDataType(allFeedData[currentFeedIndex], "battery", level);
}

function onDiscover(thingy) {
  console.log('Discovered: ' + thingy);

  var feedData = NewFeedData(thingy);
  allFeedData.push(feedData);
}

// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(searchElement, fromIndex) {

      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      // 1. Let O be ? ToObject(this value).
      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If len is 0, return false.
      if (len === 0) {
        return false;
      }

      // 4. Let n be ? ToInteger(fromIndex).
      //    (If fromIndex is undefined, this step produces the value 0.)
      var n = fromIndex | 0;

      // 5. If n ≥ 0, then
      //  a. Let k be n.
      // 6. Else n < 0,
      //  a. Let k be len + n.
      //  b. If k < 0, let k be 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      function sameValueZero(x, y) {
        return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
      }

      // 7. Repeat, while k < len
      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        // b. If SameValueZero(searchElement, elementK) is true, return true.
        if (sameValueZero(o[k], searchElement)) {
          return true;
        }
        // c. Increase k by 1. 
        k++;
      }

      // 8. Return false
      return false;
    }
  });
}