(function(){


const partTypes = {
	"core": {
		name: "Starship Core",
		icon: "border_outer",
		energyUse: 1,
		gridSize: {x: 2, y: 2},
		energyMax: 6,
		cost: null // not for sale
	},
	"structure": {
		name: "Structure Block",
		icon: "border_all",
		energyMax: 1
	},
	"corner": {
		name: "Corner Structure",
		icon: "network_cell",
		energyMax: 1
	},
	"battery-E": {
		name: "Battery Class-E",
		icon: "battery_charging_full",
		action: "toggle",
		energyMax: 10
	},
	"battery-D": {
		name: "Battery Class-D",
		icon: "battery_charging_full",
		action: "toggle",
		energyMax: 30
	},
	"solar-panels-E": {
		name: "Solar Panels E",
		icon: "flash_on",
		action: "toggle",
		energyGain: 1,
		energyMax: 1
	},
	"solar-panels-D": {
		name: "Solar Panels D",
		icon: "flash_on",
		action: "toggle",
		energyGain: 3,
		energyMax: 3
	},
	"cargo-space-E": {
		name: "Small Cargo Space",
		icon: "archive",
		storageMax: 10,
		energyMax: 1
	},
	"miner-E": {
		name: "Miner-Drones E",
		icon: "terrain",
		action: "toggle",
		oreGain: 1,
		energyUse: 1,
		energyMax: 1
	},
	"miner-D": {
		name: "Miner-Drones D",
		icon: "terrain",
		action: "toggle",
		oreGain: 3,
		energyUse: 2,
		energyMax: 2
	},
	"telescope-E": {
		name: "Telescope Class-E",
		icon: "scanner",
		action: "toggle",
		scanPower: 1,
		energyUse: 1,
		energyMax: 1
	},
	"telescope-D": {
		name: "Telescope Class-D",
		icon: "scanner",
		action: "toggle",
		scanPower: 3,
		energyUse: 2,
		energyMax: 2
	},
	"engine-E": {
		name: "Engine Class-E",
		icon: "brightness_low",
		action: "toggle",
		speed: 1,
		energyUse: 1,
		energyMax: 2
	},
	"engine-D": {
		name: "Engine Class-D",
		icon: "brightness_low",
		action: "toggle",
		speed: 3,
		energyUse: 2,
		energyMax: 4
	}
};

const defaultPartType = {
	action: null,
	cost: 1,
	scanPower: null,
	energyUse: null,
	energyGain: null,
	energyMax: null,
	oreGain: null,
	speed: null,
	storageMax: null,
	gridSize: {x: 1, y: 1}
};

_.each(partTypes, function(partType, partTypeKey){
	_.defaults(partType, defaultPartType);
	partType.imageNames = {
		"on": partTypeKey + "-on",
		"off": partTypeKey + "-off"
	};
	partType.images = { // These will be loaded during setup
		"on": null,
		"off": null
	}
});

// Expose

window.data = {
	partTypes: partTypes
};

})();