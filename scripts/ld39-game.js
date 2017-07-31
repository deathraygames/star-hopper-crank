RocketBoots.loadComponents([
	"Game",
	"Coords",
	"StateMachine",
	"Dice",
	"Entity",
	"Loop",
	"Stage",
	"World",
	"Keyboard",
	"ImageBank"
]).ready(function(){

	const SPACE_SIZE_X = 2000,
		SPACE_SIZE_Y = 1000,
		PIXELS_PER_GRID_UNIT = 32,
		DECONSTRUCT_COLOR = "rgba(200, 50, 0, 0.5)",
		CONSTRUCT_COLOR = "rgba(0, 200, 50, 0.5)",
		SYSTEM_EXPLORATION_GOAL = 30
	;

	var worldOptions = {
		name: "Space",
		isBounded: true,
		entityGroups: ["stars", "dust", "ships", "ui"],
		size: {x: SPACE_SIZE_X, y: SPACE_SIZE_Y}
	};
	var stageOptions = {
		pixelScale: 1
	};

	var states = {
		"setup": {
			start: startSetup
		},
		"splash": {
			start: startSplashState,
			end: endSplashState
		},
		"space": {
			start: startSpaceState,
			end: endSpaceState
		},
		"build": {
			start: startBuildState,
			end: endBuildState
		},
		"pause": {

		}
	};

	var g = new RocketBoots.Game({
		name: "SH:Crank",
		instantiateComponents: [
			{"state": "StateMachine", "options": {"states": states}},
			{"loop": "Loop"},
			{"dice": "Dice"},
			{"world": "World", "options": worldOptions},
			{"stage": "Stage", "options": stageOptions},
			{"images": "ImageBank"},
			{"keyboard": "Keyboard"}
		],
		version: "ld39-v1.0.0"
	});

	var $version;

	g.discoverSystem = discoverSystem;
	g.showMessage = showMessage;
	g.giveFreeOre = giveFreeOre;
	g.achievements = {
		systemsExplored: 0,
		partTypesUnlocked: {}
	};

	g.messages = [];
	g.mousePos = null;
	g.selectedPartTypeKey = null;
	g.selectPartRotationIndex = 0;
	g.buildCursor = null;
	g.buildPlacement = null;

	g.state.transition("setup");

	window.g = g;
	return g;

	// Hoisted functions

	//=================================================STATE CONTROL============

	function startSetup() {
		setup(function(){
			g.state.transition("splash");
		});
	}

	function startSplashState() {
		$('.splash').show();
		$('#stage').hide();
		//g.state.transition("space");
	}
	function endSplashState() {
		$('.splash').hide();
	}

	function startSpaceState() {
		$('.space-controls').fadeIn();
		$('.ship-info').fadeIn();
		$('#stage').show();
		g.world.entities.stars.forEach(function(starEnt){
			starEnt.isVisible = true;
		});
		g.loop.start();
		drawAll();
	}

	function endSpaceState() {
		$('.space-controls').hide();
		$('.ship-info').hide();
		$('#stage').hide();
		g.world.entities.stars.forEach(function(starEnt){
			starEnt.isVisible = false;
		});
		g.loop.stop();
	}

	function startBuildState() {
		$('.build-controls').fadeIn();
		$('.ship-info').fadeIn();
		$('#stage').show();
		g.layer.worldGridScale = PIXELS_PER_GRID_UNIT;
		g.buildCursor.isVisible = true;
		g.buildPlacement.isVisible = true;
		g.buildLoop.start();
	}

	function endBuildState() {
		$('.build-controls').hide();
		$('.ship-info').hide();
		$('#stage').hide();
		g.layer.worldGridScale = 0;
		g.buildCursor.isVisible = false;
		g.buildPlacement.isVisible = false;
		g.buildLoop.stop();
	}

	function toggleBuildState() {
		if (g.state.current.name === "space") {
			g.state.transition("build");
		} else if (g.state.current.name === "build") {
			g.state.transition("space");
		}
	}


	//===========================================SETUP==========================

	function setup(callback) {
		//g.dice.switchToPseudoRandom();
		setupStage();
		setupDOM();
		setupEvents();
		setupLoops();
		setupStars();
		setupShip();
		setupImages(callback);
		setupBuildCursors();
		//selectRemovePart();
		selectPart("structure");
	}

	function setupImages(callback) {
		var imageMap = {};
		_.each(data.partTypes, function(partType){
			_.each(partType.imageNames, function(imageNameArr, imageKey){
				_.each(imageNameArr, function(imageName){
					imageMap[imageName] = "parts/" + imageName + ".png";
				});
			});
		});
		g.images.load(imageMap, function(){
			_.each(data.partTypes, function(partType){
				_.each(partType.imageNames, function(imageNameArr, imageKey){
					partType.images[imageKey] = [];
					_.each(imageNameArr, function(imageName){
						partType.images[imageKey].push(g.images.get(imageName));
					});
				});
			});
			callback();
		});
	}

	function setupStage() {
		let layer = g.stage.addLayer("galaxy");
		//g.stage.camera.set({x: 0, y: PLANET_RADIUS/2}).focus();
		//g.stage.camera.follow(g.bot);
		g.stage.resize();
		g.layer = g.stage.layers[0]; // Only going to use one layer

		// Connect all world entities to the layer
		g.stage.connectToEntity(g.world);
		g.layer.connectEntities(g.world.entities.all);
		g.layer.worldGridScale = 0;
	}

	function setupDOM() {
		let partListHTML = '';
		// Write version
		$version = $('.version');
		$version.html(g.version);
		// Write part list
		_.each(data.partTypes, function(partType, partTypeKey){
			if (partType.cost !== null) {
				partListHTML += (
					'<li data-parttypekey="' + partTypeKey + '">'
						+ '<i class="material-icons">' + partType.icon + '</i> '
						+ '<span class="name">' + partType.name + '</span>'
						+ '<span class="cost">' + partType.cost + '</span>'
						+ '<div class="details">'
				);
				for (let p in partType) {
					if (partType[p] && typeof partType[p] === "number") {
						partListHTML += '<div>' + p + ': ' + partType[p] + '</div>';
					}
				}
				partListHTML += '</div></li>';
			}
		});
		$('.part-list').html(partListHTML);
	}

	function setupEvents() {
		const $window = $(window);
		const WHEEL_SCALE = -800;
		const MAX_ZOOM_PROPORTION = 2;
		const MIN_ZOOM_PROPORTION = 0.1;
		$window.on('wheel', function(e){
			let scale = (e.originalEvent.deltaY / WHEEL_SCALE);
			let proportion = 1 + scale;
			proportion = Math.min(MAX_ZOOM_PROPORTION, proportion);
			proportion = Math.max(MIN_ZOOM_PROPORTION, proportion);
			zoom(proportion);
			e.preventDefault();
		});

		let isDown = false;
		let didMove = false;
		let downPos = new RocketBoots.Coords();
		let $layer = $(g.layer.element);
		let $stage = $(g.stage.element);
		$layer.on('mousedown touchstart', function(e){
			isDown = true;
			didMove = false;
			downPos.set({x: e.pageX, y: e.pageY});
		}).on('mousemove touchmove', function(e){
			if (isDown) {
				let newPos = new RocketBoots.Coords(e.pageX, e.pageY);
				let delta = downPos.subtract(newPos);
				let distance = delta.getMagnitude();
				delta.y = delta.y * -1;
				g.stage.camera.move(delta);
				downPos.set(newPos);
				didMove = (distance > 1);
				if (didMove) {
					//closeInfo();
					$layer.addClass("moving");
				}
				e.preventDefault();
			}

			g.mousePos = g.stage.getPosition(e.offsetX, e.offsetY);
			if (g.state.current.name === "build") {
				updateBuildCursors(g.mousePos);
			}
		}).on('mouseup touchend', function(e){
			isDown = false;
			downPos.clear();
			$layer.removeClass("moving");
		}).on('click touch', function(e){
			if (!didMove) {
				let pos = g.stage.getPosition(e.offsetX, e.offsetY);
				if (g.state.current.name === "build") {
					doBuildAction(pos);
				}
				//showSystemInfo(pos);
			}
			didMove = false;
		});

		// Button clicks
		$('button.space').click(function(){
			g.state.transition("space");
		});
		$('button.build').click(toggleBuildState);
		$('button.menu').click(function(){
			g.state.transition("splash");
		});
		$('button.crank').click(toggleCore);
		$('button.scanners').click(toggleScanners);
		$('button.miners').click(toggleMiners);
		$('button.engines').click(toggleEngines);
		$('button.navigation').click(showNavigation);
		$('button.closeNavigation').click(closeNavigation);
		$('.found-locations-list').on('click', 'li', function(){
			selectLocationAsTarget($(this).data("locationindex"));
			updateNavigation();
			//closeNavigation();
		});
		$('button.previousPart').click(selectPreviousPart);
		$('button.nextPart').click(selectNextPart);
		$('button.deletePart').click(function(){
			selectRemovePart();
		});
		$('button.selectPart').click(function(){
			$('.part-selection').fadeIn();
			$('.build-controls').hide();
		});
		$('.part-list').on('click', 'li', function(e){
			selectPart($(this).data("parttypekey"));
			$('.part-selection').fadeOut();
			$('.build-controls').fadeIn();
		});
		//g.stage.addClickEvent(showSystemInfo);
	}

	function setupLoops() {
		g.loop.set(drawAll, 10)
			.addAction(drawInfo, 500)
			.addAction(simulateShip, 250)
			//.addAction(botAction, ACTION_DELAY)
			//.addAction(buildingProcessing, BUILDING_PROCESS_DELAY)
		;
		g.buildLoop = new RocketBoots.Loop();
		g.buildLoop.set(drawAll, 10);
	}

	function setupShip() {
		g.ship = new Starship({
			world: g.world
		});
		//g.ship.addPart("corner", 		{x: -1, y: 1}, 3);
		g.ship.addPart("corner-1", 		{x: 0, y: 1}, 0);
		g.ship.addPart("structure", 	{x: 1, y: 1}, 0);
		g.ship.addPart("corner-2", 		{x: 2, y: 1}, 0);
		g.ship.addPart("engine-E", 		{x: 3, y: 0}, 0);

		g.ship.addPart("structure", 	{x: 2, y: 0}, 1);
		g.ship.addPart("structure", 	{x: 2, y: -1}, 0);
		g.ship.addPart("corner-3", 	{x: 2, y: -2}, 1);

		g.ship.addPart("cargo-space-E", {x: 1, y: -2}, 0);
		g.ship.addPart("miner-E", 		{x: 0, y: -2}, 2);
		//g.ship.addPart("corner", 		{x: -1, y: -2}, 2);
		g.ship.addPart("telescope-E", 	{x: -1, y: -1}, 3);
		g.ship.addPart("corner-1", 		{x: -1, y: 0}, 3);

		//g.ship.addPart("engine-E", 		{x: 3, y: 0}, 1);

		//g.ship.addPart("solar-panels-D", {x: 2, y: 2}, 0);
		//g.ship.addPart("solar-panels-D", {x: 1, y: 2}, 0);

		g.ship.switchMiners(false);
		g.ship.switchScanners(false);
		g.ship.switchEngines(false);
		g.ship.switchCore(false);

		//discoverSystem();
		//discoverSystem();
		//discoverSystem();

		setPartsUnlocked();
	}

	function setupBuildCursors() {
		g.buildCursor = new RocketBoots.Entity({
			color: DECONSTRUCT_COLOR,
			size: {x: PIXELS_PER_GRID_UNIT, y: PIXELS_PER_GRID_UNIT},
			isVisible: false
		});
		g.buildPlacement = new RocketBoots.Entity({
			color: DECONSTRUCT_COLOR,
			size: {x: PIXELS_PER_GRID_UNIT, y: PIXELS_PER_GRID_UNIT},
			isVisible: false
		});
		g.world.putIn(g.buildCursor, ["ui"]);
		g.world.putIn(g.buildPlacement, ["ui"]);		
	}

	function setupStars() {
		const STAR_NUM = 200;
		for (var i = 0; i < STAR_NUM; i++) {
			let opacity = g.dice.random();
			let star = new RocketBoots.Entity({
				draw: "circle",
				radius: 1,
				size: {x: 1, y: 1},
				pos: {
					x: g.dice.getRandomAround(SPACE_SIZE_X), 
					y: g.dice.getRandomAround(SPACE_SIZE_Y)
				},
				color: "rgba(255, 255, 255, " + opacity + ")",
				isPhysical: false,
				world: g.world
			});
			g.world.putIn(star, ["stars"]);
		}
		for (var i = 0; i < STAR_NUM; i++) {
			let opacity = g.dice.random() / 2;
			let star = new RocketBoots.Entity({
				draw: "circle",
				radius: 2,
				size: {x: 2, y: 2},
				pos: {
					x: g.dice.getRandomAround(SPACE_SIZE_X), 
					y: g.dice.getRandomAround(SPACE_SIZE_Y)
				},
				color: "rgba(255, 255, 255, " + opacity + ")",
				isPhysical: false,
				world: g.world
			});
			g.world.putIn(star, ["dust"]);
		}
	}

	//===========================================DRAW===========================

	function drawAll() {
		g.stage.draw();
	}

	function drawInfo() {
		let e = g.ship.getEnergy();
		let eMax = g.ship.getEnergyMax();
		let ePercent = getPercentage(e, eMax);
		let n = g.ship.getScanProgress();
		let nMax = 100;
		let nPercent = getPercentage(n, nMax);
		let s = g.ship.getStorageUsed();
		let sMax = g.ship.getStorageMax();
		let sPercent = getPercentage(s, sMax);

		$('.energyNumbers').html(getNumberString(e) + ' / ' + eMax);
		if (e <= 0) {
			$('.energyNumbers').addClass("bad");
		} else {
			$('.energyNumbers').removeClass("bad");
		}
		$('.energy-info .bar').css("width", getMaxBarWidth(eMax) + "%");
		$('.energy-info .bar > span').css("width", ePercent + "%");
		$('.energy-info .rate').html(getRateString(g.ship.energyRate));
		
		$('.scanNumbers').html(getNumberString(n) + ' / ' + nMax + '%');
		$('.scan-info .bar').css("width", "100%");
		$('.scan-info .bar > span').css("width", nPercent + "%");
		$('.scan-info .rate').html(getRateString(g.ship.scanRate));
		
		$('.storageNumbers').html(getNumberString(s) + ' / ' + sMax);
		$('.storage-info .bar').css("width", getMaxBarWidth(sMax) + "%");
		$('.storage-info .bar > span').css("width", sPercent + "%");
		$('.storage-info .rate').html(getRateString(g.ship.oreRate));

		{
			let numbersHTML;
			let d = g.ship.getDistanceToTarget();
			let dMax = g.ship.getOriginalDistanceToTarget();
			let traveled = dMax - d;
			let dPercent = getPercentage(traveled, dMax);
			let rate = getRateString(g.ship.speedRate);
			if (g.ship.hasTargetLocation()) {
				numbersHTML = getNumberString(d) + " / " + dMax;
			} else {
				numbersHTML = "--";
			}
			$('.travel-info .numbers').html(numbersHTML);
			$('.travel-info .bar > span').css("width", dPercent + "%");
			$('.travel-info .rate').html(rate);
		}
		{
			let n = g.achievements.systemsExplored;
			let percent = getPercentage(n, SYSTEM_EXPLORATION_GOAL);
			$('.systems-explored .numbers').html(getNumberString(n) + ' / ' + SYSTEM_EXPLORATION_GOAL);
			$('.systems-explored .bar > span').css("width", percent + "%");
		}
		{
			let n = _.size(g.achievements.partTypesUnlocked);
			let max = _.size(data.partTypes);
			let percent = getPercentage(n, max);
			$('.parts-unlocked .numbers').html(n + ' / ' + max);
			$('.parts-unlocked .bar > span').css("width", percent + "%");
		}
	}

	function getNumberString(n) {
		return (Math.floor( (n * 100) ) / 100);
	}

	function getRateString(rate) {
		if (rate === 0) {
			rate = '';
		} else if (rate > 0) {
			rate = getNumberString(rate);
			rate = '+' + rate;
		}
		return rate;
	}

	function getPercentage(x, xMax) {
		if (xMax == 0 || typeof x !== "number" || typeof xMax !== "number") {
			return 0;
		}
		return Math.min(((x / xMax) * 100), 100);
	}
	function getMaxBarWidth(max) {
		const someMax = 1000;
		let barPercent = (max / someMax) * 100;
		return Math.max(Math.min(100, barPercent), 30);
	}

	function updateBuildCursors(pos) {
		let actionPos;
		g.buildCursor.pos.set(pos);
		if (g.selectedPartTypeKey === null) {
			actionPos = g.ship.getNearestPositionOnGrid(pos);
		} else {
			actionPos = g.ship.getNearestEmptyPositionOnGrid(pos);
		}
		g.buildPlacement.pos.set(actionPos);
	}

	function updateNavigation() {
		let $target = $('.target-location');
		let $noTarget = $('.no-target-location');
		let $foundList = $('.found-locations-list');
		let $noFound = $('.no-found-locations');
		if (g.ship.targetLocation === null) {
			$noTarget.fadeIn();
			$target.hide();
		} else {
			$noTarget.hide();
			$target.find('.info').html(g.ship.targetLocation.getNameWithType());
			$target.fadeIn();
		}
		if (g.ship.foundLocations.length === 0) {
			$noFound.fadeIn();
			$foundList.hide();
		} else {
			let h = '';
			_.each(g.ship.foundLocations, function(loc, i){
				h += (
					'<li data-locationindex="' + i + '">'
						+ loc.getNameWithType()
					+ '</li>'
				);
			});
			$noFound.hide();
			$foundList.html(h).fadeIn();
		}
	}

	function showMessage(m) {
		let $messages = $('.messages');
		// g.messages.push(m);
		$messages.stop().hide(function(){
			$messages.html(m).fadeIn(function(){
				$messages.fadeOut(5000);
			});
		});
	}

	//===========================================BUILD ACTIONS==================

	function selectPart(partTypeKey) {
		let part = data.partTypes[partTypeKey];
		if (typeof part === "object") {
			g.selectedPartTypeKey = partTypeKey;
			$('.selected-part-name').html(part.name);
			g.buildCursor.image = part.images.on[0];
			g.buildCursor.draw = {};
			g.buildPlacement.color = CONSTRUCT_COLOR;
			
		}
	}

	function selectNextPart(n) {
		if (g.selectedPartTypeKey === null) {
			return selectPart("structure");
		}
		n = (typeof n !== "number") ? 1 : n;
		let partTypesArray = _.keys(data.partTypes);
		let i = partTypesArray.indexOf(g.selectedPartTypeKey);
		i += n;
		if (i < 0) { i = partTypesArray.length - 1; }
		else if (i >= partTypesArray.length) { i = 0 }
		selectPart(partTypesArray[i]);
	}

	function selectPreviousPart() {
		return selectNextPart(-1);
	}

	function selectRemovePart() {
		g.selectedPartTypeKey = null;
		$('.selected-part-name').html("DECONSTRUCT");
		g.buildCursor.image = null;
		g.buildCursor.draw = "rectangle";
		g.buildCursor.color = DECONSTRUCT_COLOR;
		g.buildPlacement.image = null;
		g.buildPlacement.draw = "rectangle";
		g.buildPlacement.color = DECONSTRUCT_COLOR;
	}

	function doBuildAction(pos) {
		if (g.selectedPartTypeKey === null) {
			let part = g.ship.getNearestPart(pos);
			deconstruct(part);
		} else {
			construct(g.selectedPartTypeKey, g.selectPartRotationIndex, pos);
		}
		drawInfo();
	}

	function construct(partTypeKey, rotationIndex, pos) {
		let gridPos = g.ship.getNearestEmptyGridPosition(pos);
		let partType = data.partTypes[partTypeKey];
		let ore = g.ship.getOre();
		if (typeof partType.cost === "number" && ore >= partType.cost) {
			let notPaid = g.ship.removeOre(partType.cost);
			if (notPaid > 0) {
				g.showMessage("Something went wrong.");
			}
			g.ship.addPart(partTypeKey, gridPos, rotationIndex);
			setPartsUnlocked();
		} else {
			g.showMessage("Cannot afford this. You need more ore.");
		}
		
	}

	function deconstruct(part) {
		if (part.type.cost === null) {
			g.showMessage("Cannot delete this part.");
		} else {
			let rebateOre = part.type.cost * 0.5;
			g.ship.removePart(part);
			g.ship.gainOre(rebateOre);
		}		
	}

	//===========================================SPACE ACTIONS==================

	function simulateShip() {
		g.ship.simulate(0.25); // TODO: calculate t based on real time
		if (g.ship.isScanDone()) {
			// TODO: chance to find multiple systems
			discoverSystem();
			g.ship.resetScan();
		}
		if (g.ship.hasTargetLocation() && g.ship.getDistanceToTarget() <= 0) {
			arriveAtSystem();
			g.ship.switchEngines(false);
		}
		g.ship.core.incrementAnimation();

		moveStars();
	}

	function moveStars() {
		let starMoveX = Math.max((g.ship.speedRate * 2), 1);
		let starMoveY = (g.ship.speedRate > 0) ? 0 : 0.5;
		let spaceSize2 = {
			x: SPACE_SIZE_X * 2, y: SPACE_SIZE_Y * 2
		};
		let spaceSizeNeg = {
			x: SPACE_SIZE_X * -1, y: SPACE_SIZE_Y * -1
		};
		g.world.loopOverEntitiesByType("dust", function(i, ent){
			ent.pos.x += starMoveX;
			ent.pos.y += starMoveY;
			if (ent.pos.x > SPACE_SIZE_X) {
				ent.pos.x -= spaceSize2.x;
			} else if (ent.pos.x < spaceSizeNeg.x) {
				ent.pos.x += spaceSize2.x;
			}
			if (ent.pos.y > SPACE_SIZE_Y) {
				ent.pos.y -= spaceSize2.y;
			} else if (ent.pos.y < spaceSizeNeg.y) {
				ent.pos.y += spaceSize2.y;
			}
		});
	}

	function toggleEngines() {
		let enginesOn;
		enginesOn = g.ship.toggleEngines();
		if (enginesOn) {
			if (g.ship.targetLocation === null) {
				g.showMessage("Where are you going? You need to set a target location (Navigation).");
			} else {
				g.showMessage("You fly into space towards " + g.ship.targetLocation.getNameWithType());
				g.ship.switchMiners(false);
				g.ship.location = null;
			}
		} else {
			g.showMessage("Engines OFF");
		}
	}

	function toggleScanners() {
		let h = '';
		let scannersOn = g.ship.toggleScanners();
		if (g.ship.location instanceof Location) {
			h += "At " + g.ship.location.getNameWithType() + '<br />';
		}
		h += 'Scanners ' + ((scannersOn) ? 'ON' : 'OFF');
		g.showMessage(h);
	}

	function toggleMiners() {
		let h = '';
		if (g.ship.location instanceof Location) {
			let minersOn = g.ship.toggleMiners();
			h += 'Miner drones ' + ((minersOn) ? 'ON' : 'OFF');
		} else {
			h = "You're in deep space. You cannot activate miner drones here.";
		}
		g.showMessage(h);
	}

	function toggleCore() {
		let on = g.ship.toggleCore();
		g.showMessage("Crank " + ((on) ? "ON" : "OFF"));
	}

	function arriveAtSystem() {
		g.ship.location = g.ship.targetLocation;
		g.ship.targetLocation = null;
		g.showMessage("Arrived at " + g.ship.location.getNameWithType());
		g.achievements.systemsExplored++;
	}

	function discoverSystem() {
		let newLocation = new Location();
		updateNavigation();
		g.ship.findLocation(newLocation);
		g.showMessage("Found new system: " + newLocation.name);
	}

	function setPartsUnlocked() {
		_.each(g.ship.parts, function(part){
			g.achievements.partTypesUnlocked[part.partTypeKey] = true;
		});
	}

	function showNavigation() {
		updateNavigation();
		$('.navigation-panel').fadeIn();
	}

	function closeNavigation() {
		$('.navigation-panel').hide();		
	}

	function selectLocationAsTarget(locationIndex) {
		g.ship.targetLocation = g.ship.foundLocations[locationIndex];
		g.ship.resetFoundLocations();
	}

	function giveFreeOre(n) {
		g.ship.gainOre(n);
	}

	// Junk?


	function findNearestSystem(pos) {
		let closestDistance = Infinity;
		let closestSystem = null;
		_.each(systems, function(system){
			let d = system.pos.getDistance(pos);
			if (d < closestDistance) {
				closestDistance = d;
				closestSystem = system;
			}
		});
		closestSystem.isHightlighted = true;
		return closestSystem;
	}



	function zoom(amount) {
		/*
		g.stage.camera.pos.multiply(amount);
		_.each(systems, function(sys){
			sys.pos.multiply(amount);
		});
		closeInfo();
		*/
	}


}).init();