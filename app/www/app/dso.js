/**
 * Things related to the watchlist or catalog
 */

import { eq_to_geo, geo_to_eq } from "./tools.js";

/**
 * Definitions of possible DSO types
 */
function Type(short_name) {
    this.short_name = short_name;

    this.long_name = null;
    switch (short_name) {
        case "gg":  this.long_name = "Galaxy cluster"; break;
        case "g":   this.long_name = "Galaxy"; break;
        case "s":   this.long_name = "Spiral galaxy"; break;
        case "s0":  this.long_name = "Lenticular galaxy"; break;
        case "sd":  this.long_name = "Dwarf galaxy"; break;
        case "i":   this.long_name = "Irregular galaxy"; break;
        case "e":   this.long_name = "Elliptical galaxy"; break;
        case "oc":  this.long_name = "Open cluster"; break;
        case "gc":  this.long_name = "Globular cluster"; break;
        case "dn":  this.long_name = "Dark nebula"; break;
        case "bn":  this.long_name = "Bright nebula"; break;
        case "sfr": this.long_name = "Star forming region"; break;
        case "rn":  this.long_name = "Reflection nebula"; break;
        case "pn":  this.long_name = "Planetary nebula"; break;
        case "snr": this.long_name = "Supernova remnant"; break;
        case "en":  this.long_name = "Emmision nebula"; break;
        default:
            console.error(`Unknown DSO type ${short_name}`);
            long_name = "UNKNOWN";
            break;
    }
}

/**
 * Represents a DSO present on the Catalog
 */
export function Dso(dsos_data, id, appears_on) {
    // Equal to the index on the DsoManager.catalog where this object is located
    this.id = id;

    // Original ID from data, similar to name but without spaces
    this._data_id = dsos_data.features[id].id;

    this.name = dsos_data.features[id].properties.name;

    // Equatorial coordinates
    this.coords = geo_to_eq(dsos_data.features[id].geometry.coordinates);

    this.type = new Type(dsos_data.features[id].properties.type);
    this.mag = dsos_data.features[id].properties.mag;

    this.appears_on = appears_on;

    this._catalog_tr = null; // Reference to JQuery table row
    this.on_watchlist = false;

    // Get dimensions
    {
        let values = dsos_data.features[id].properties.dim.split("x");

        let result;
        if (values.length == 2) {
            this.dimensions = [parseFloat(values[0]), parseFloat(values[1])];
        } else if (values.length == 1) {
            this.dimensions = [parseFloat(values[0]), parseFloat(values[0])];
        } else {
            let string = dsos_data.features[id].properties.dim;
            console.error(`Failed to parse dimensions: ${string}`);
        }

        if (isNaN(this.dimensions[0]) || isNaN(this.dimensions[1])) {
            let string = dsos_data.features[id].properties.dim;
            console.error(`Failed to parse dimensions: ${string}`);
        }
    }

    /**
     * Set reference to the JQuery tr where this object is being shown
     */
    this.set_catalog_tr = function(tr) {
        this._catalog_tr = tr;
    }

    /**
     * Get reference to the JQuery tr where this object is being shown
     *
     * Can return null
     */
    this.get_catalog_tr = function() {
        return this._catalog_tr;
    }

    /**
     * Calculate altitude and azimut on a given date and location
     *
     * Returns on horizontal coordinate system
     * - Altitude: -90 to 90
     * - Azimuth: 0 to 360
     *
     * Give as argument a Date() and [lat, long]
     */
    this.get_alt_az = function(date, location) {
        return Celestial.horizontal(date, eq_to_geo(this.coords), location);
    }
}

/**
 * Represents a DSO present on the Watchlist
 */
export function WatchDso(dso, notes, style) {
    this.dso = dso; // Reference to Dso object on the Catalog
    this.notes = notes;
    this.style = style;

    this._watchlist_tr = null; // Reference to JQuery table row

    /**
     * Set reference to the JQuery tr where this object is being shown
     */
    this.set_watchlist_tr = function(tr) {

        this.watchlist_tr = tr;
    }

    /**
     * Get reference to the JQuery tr where this object is being shown
     */
    this.get_watchlist_tr = function() {

        if (this.watchlist_tr == null) {
            console.error(`Can't get tr of watch_dso: ${watch_dso}`);
            return;
        }
        return this.watchlist_tr;
    }
}

/**
 * Manages the Watchlist and Catalog
 */
export function DsoManager(dsos_data, catalogs_data) {

    this._catalog = [];
    this._watchlist = [];
    this._change_callback = () => {};

    // Catalog sorting and filtering function being used on Dsos
    this._catalog_sort = (a, b) => 0;
    this._catalog_filter = dso => true;

    // Watchlist sorting and filtering function being used on WatchDsos (not Dsos)
    this._watchlist_sort = (a, b) => 0;
    this._watchlist_filter = dso => true;

    // Create the catalog
    for (let id = 0; id < dsos_data.features.length; id++) {

        // Find in the catalogs list the id and return the appears_on array
        // of the element

        let element = catalogs_data.find(e => e.id == id);

        let appears_on;
        if (typeof element == "undefined") {
            appears_on = [];
        } else {
            appears_on = element.appears_on;
        }

        this._catalog.push(new Dso(dsos_data, id, appears_on));
    }

    /**
     * Add object to watchlist
     *
     * notes and style must be null if the object is being added by the user. If
     * the object is being loaded from the server notes and style should be set.
     *
     * Returns the watch_dso if the object was added succesfully, else returns
     * null
     */
    this.watchlist_add = function(id, notes, style) {

        // Check if the object already exists
        let index = this._watchlist.findIndex(watch_dso => watch_dso.dso.id == id);

        if (index > -1) {
            console.error("Element already exists id:", id);
            return null;
        }

        if (notes == null) { notes = "" }
        if (style == null) { style = 0 }

        let watch_dso = new WatchDso(this._catalog[id], notes, style);
        this._catalog[id].on_watchlist = true;
        this._watchlist.push(watch_dso);

        this._change_callback(watch_dso, true);

        return watch_dso;
    }

    /**
     * Remove object from watchlist
     */
    this.watchlist_remove = function(watch_dso) {

        let index = this._watchlist.findIndex(e => watch_dso.dso.id == e.dso.id);
        if (index > -1) {
            this._watchlist.splice(index, 1);
            watch_dso.dso.on_watchlist = false;
            this._change_callback(watch_dso, false);

            return;
        } else {
            console.error("Tried to remove unexistent id:", watch_dso.dso.id);
        }

    }

    /**
     * Set sorting function for catalog
     *
     * Used when calling get_catalog_view(). The function in given to
     * Array.prototipe.sort(), so it should take two Dsos and return less than 0
     * if A is before B or more than 0 if A is after B
     */
    this.catalog_set_sort = function(f) {
        this._catalog_sort = f;
    }

    /**
     * Set filtering function for catalog
     *
     * Used when calling get_catalog_view(). The function in given to
     * Array.prototipe.filter(), so it should take a Dso and return true or
     * false.
     */
    this.catalog_set_filter = function(f) {
        this._catalog_filter = f;
    }

    /**
     * Set sorting function for watchlist
     *
     * Used when calling get_watchlist_view(). The function in given to
     * Array.prototipe.sort(), so it should take two WatchDsos and return less
     * than 0 if A is before B or more than 0 if A is after B
     */
    this.watchlist_set_sort = function(f) {
        this._watchlist_sort = f;
    }

    /**
     * Set filtering function for watchlist
     *
     * Used when calling get_watchlist_view(). The function in given to
     * Array.prototipe.filter(), so it should take a WatchDso and return true or
     * false.
     */
    this.watchlist_set_filter = function(f) {
        this._watchlist_filter = f;
    }

    /**
     * Get entire catalog
     */
    this.get_catalog = function() {
        return this._catalog;
    }

    /**
     * Get entire watchlist
     */
    this.get_watchlist = function() {
        return this._watchlist;
    }

    /**
     * Get sorted and filtered catalog
     */
    this.get_catalog_view = function() {
        return this._catalog
            .filter(this._catalog_filter)
            .sort(this._catalog_sort);
    }

    /**
     * Get sorted and filtered watchlist
     */
    this.get_watchlist_view = function() {
        return this._watchlist
            .filter(this._watchlist_filter)
            .sort(this._watchlist_sort);
    }

    /**
     * Set a function to call when a dso is added or removed from the watchlist.
     *
     * Used by the TableManager to get notified and disable the add button
     * accordingly.
     *
     * Gives as argument the WatchDso that was added or removed and a boolean
     * that is true when added and false when removed
     */
    this.set_watchlist_change_callback = function(f) {
        this._change_callback = f;
    }
}
