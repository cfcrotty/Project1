/**
 * Once all the data is formatted into a table, remove status message and show table
 * @param {boolean} worked False if there was an error getting data from APIs
 */
function finishedCalc(worked) {

    //Update the global variable
    dataReady = worked;

    if (worked) {
        $("#solarTable").css("display", "block");
        $("#solarChart").css("display", "none");
        $("#startUp").css("display", "none");
        $(window).scrollTop($("#firstRow").offset().top).scrollLeft($("#firstRow").offset().left);
        google.load("visualization", "1", { packages: ["corechart"] });
        $("#menuTableChartText").text("Chart");
    }
}


var generatesOn = {
    //Will be filled by correlatePredictions
};

/**
 * Gets the history for energy production and weather, calls another function to correlate them, and populates the table.
 * @param {number} siteID The ID of the site the user is interested in, if empty defaults to Richard Moore's
 * @param {moment} endDate Optional, if empty is set to yesterday
 * @param {moment} startDate Optional, requires endDate. If empty defaults to 30 days prior to endDate
 */
var getWeatherAndEnergyHist = function (siteID, endDate, startDate) {
    if (siteID === undefined) {
        siteID = "961882";
    }
    if (endDate == undefined) {
        endDate = moment().subtract(1, 'days');
    }
    if (startDate == undefined) {
        startDate = moment().subtract(30, 'days');
    }
    getProductionHistory(siteID, startDate.format("X"), endDate.format("X"), function (prodHist) {
        //Make array for use in chart public
        gsolarData = prodHist;
        showWeather(siteID, startDate.format("X"), endDate.format("X"), function (weathHist) {
            correlateProduction(prodHist, weathHist, function () {
                //loop through them creating table rows for historical data
                for (let i = 0; i < prodHist.length; i++) {
                    var day = prodHist[i].date;
                    displayRow(moment.unix(prodHist[i].dateUnix), weathHist[day].icon, weathHist[day].summary, prodHist[i].powerGenerated);
                }
                displayFuture(siteID);
            });
        }, false);
    });
}

/**
 * 
 * @param {array} weatherHist The previous 30 days' weather, oldest at 0
 * @param {object array} energyHist The previous 30 days' dates and energy production, oldest at 0
 * @param {function} callback The function to be started after the future is correlated
 */
var correlateProduction = function (energyHist, weatherHist, callback) {
    //Create variables for averaging energy based on weather. M is mostly
    var numSunny = 0, genSunny = 0;
    var numMSunny = 0, genMSunny = 0;
    var numMCloudy = 0, genMCloudy = 0;
    var numCloudy = 0, genCloudy = 0;

    //Use sort the energy generated by that day's weather
    for (let i = 0; i < energyHist.length; i++) {
        var dayWeather = weatherHist[energyHist[i].date];
        //If we don't have weather history for that day,
        //Restart the loop on the next day
        if(dayWeather === undefined) {
            continue;
        }
        //weatherHist array uses day as key. Cloudcover range is 0-1
        if (dayWeather.cloudCover < .25) {
            numSunny++;
            genSunny += energyHist[i].powerGenerated;
        } else if (dayWeather.cloudCover < .5) {
            numMSunny++;
            genMSunny += energyHist[i].powerGenerated;
        } else if (dayWeather.cloudCover < .7) {
            numMCloudy++;
            genMCloudy += energyHist[i].powerGenerated;
        } else {
            numCloudy++;
            genCloudy += energyHist[i].powerGenerated;
        }
    }

    //Update predictions using the sorted data's averages
    generatesOn.sunny = Math.floor(genSunny / numSunny);
    generatesOn.mostlySunny = Math.floor(genMSunny / numMSunny);
    generatesOn.mostlyCloudy = Math.floor(genMCloudy / numMCloudy);
    generatesOn.cloudy = Math.floor(genCloudy / numCloudy);

    callback();
};

/**
 * Starting today, creates table rows based on predicted weather and energy
 * @param {string} siteID The SolarEdge site ID
 * @param {number} howManyDays How many days (including today) to predict. Defaults to 7
 */
var displayFuture = function (siteID, howManyDays) {
    if (howManyDays === undefined) {
        howManyDays = 7;
    }
    var day = moment();
    //Get the forcast
    showWeather(siteID, day.format("X"), day.add(howManyDays, 'days').format("X"), function (weatherHist) {
        //Undo the addition in showWeather's parameters
        day.subtract(howManyDays, 'days');
        //Use the forecast to predict the energy generated
        for(var daysOut = 0; daysOut < howManyDays; daysOut++) {
            let prediction = weatherHist[day.format("YYYY-MM-DD")];
            let generated;
            if (prediction.cloudCover < .25) {
                generated = generatesOn.sunny;
            } else if (prediction.cloudCover < .5) {
                generated = generatesOn.mostlySunny;
            } else if (prediction.cloudCover < .7) {
                generated = generatesOn.mostlyCloudy;
            } else {
                generated = generatesOn.cloudy;
            }
            //Update the table
            displayRow(day, prediction.icon, prediction.summary, generated);
            //Add the futre day to gsolarData for the chart
            var thisDaysData = {
                date: day.clone(),
                powerGenerated: generated
            }
            gsolarData.push(thisDaysData);
            day.add(1, 'days');
        }

        
        finishedCalc(true);
    }, true);
}