"use strict";

import { object_styles } from "./const.js";
import { config } from "./config.js";
import * as data from "./data.js";
import { watchlist_create_header, watchlist_create_row, catalog_create } from "./tables.js";

let aladin;
let aladin_catalogs = {};

// Objects in "catalog"
aladin_catalogs[get_class_string(-1)] = A.catalog({ shape: "circle", color: "#555555" });

// Objects in "watchlist-{i}"
for (let i = 0; i < object_styles.length; i++) {
    aladin_catalogs[get_class_string(i)] = A.catalog({
        name: object_styles[i].aladin_name,
        shape: object_styles[i].aladin_shape,
        color: object_styles[i].color,
    });
}

console.log(aladin_catalogs);

/**
 * Delete object from watchlist
 *
 * Deletes both on server and on client
 */
function watchlist_delete(id) {
    $.ajax({
        type: "DELETE",
        url: "/api/v1/watchlist/object" + $.param({ "id": id }),
        dataType: "json",
    }).done(function(dsos_data) {

        $(`#watchlist-obj-${id}`).remove();
        // TODO

    }).fail(function(jqXHR, textStatus, errorThrown) {
        alert("Error " + id);
        $(`#watchlist-obj-${id}`).remove();
        // TODO

    });
}

/**
 * Add object to watchlist, both on client and on server
 */
function watchlist_add(dsos_data, id) {
    // TODO

    let style = 0;
    let notes = "";

    watchlist_create_row(
        dsos_data,
        id,
        notes,
        style,
        watchlist_delete,
        watchlist_save,
        function(id) { object_goto(dsos_data, id) },
    ).appendTo("#watchlist-table tbody");
}

/**
 * Save changes on given object id to server
 */
function watchlist_save(id) {
    $.ajax({
        type: "PUT",
        url: "/api/v1/watchlist/object" + $.param({ "id": id }),
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({
            id: id,
            notes: $(`#watchlist-obj-${id} .objects-notes textarea`).val(),
            style: $(`#watchlist-obj-${id} .objects-style select`).val(),
        }),
        dataType: "json",
    }).done(function(dsos_data) {

        // TODO

    }).fail(function(jqXHR, textStatus, errorThrown) {
        alert("Error " + id);
        // TODO

    });
}


/**
 * Show given id on the sky survey map
 */
function object_goto(dsos_data, id) {
    let dim = data.get_dimensions(dsos_data, id);

    aladin.gotoRaDec(
        data.get_ra(dsos_data, id),
        data.get_dec(dsos_data, id),
    );
    console.log(dim);
    // Set FOV to the biggest of width,height of object, convert dimensions from
    // arcminutes to degrees
    aladin.setFov(Math.max(dim[0], dim[1]) / 60);

    // Scroll page to map
    window.location.hash = "aladin-map";
}

// TODO: Not working, debug doing modifications to celestial.js
function update_map_datetime(datetime) {
    Celestial.date(datetime);
    Celestial.apply();
    Celestial.display(config);
}

// TODO: Not working, debug doing modifications to celestial.js
function update_map_location(lat, long) {
    config.geopos = [lat, long];
    Celestial.apply(config);
    Celestial.display(config);
}

/**
 * Translate the given integer to a class string
 *
 * Mapping:
 *
 * - -1: "catalog"
 * - 0: "watchlist-0"
 * - 1: "watchlist-1"
 * - 2: "watchlist-2"
 * - ...
 *
 * Used to indicate the style of an object. I use it to work with Celestial or
 * Aladin
 */
function get_class_string(style) {
    let class_string = "catalog";
    if (style >= 0)
    {
        class_string = `watchlist-${style}`;
    }
    return class_string;
}

/**
 * Set celestial redraw function
 *
 * Determines how the narkers will look on the celestial map
 */
function celestial_redraw() {
    let text_style = {
        fill: "#f0f",
        font: "bold 15px 'Saira Condensed', sans-serif",
        align: "left",
        baseline: "bottom"
    };
    let point_style = {
        stroke: "#ff00ff",
        width: 3,
        fill: "rgba(255, 204, 255, 0.4)"
    };

    Celestial.container.selectAll(`.watchlist-0`).each(function(d) {

        // If point is visible
        if (Celestial.clip(d.geometry.coordinates)) {

            // Get point coordinates
            let pt = Celestial.mapProjection(d.geometry.coordinates);

            let radius = 10;

            Celestial.setStyle(point_style);

            // Draw a circle
            Celestial.context.beginPath();
            Celestial.context.arc(pt[0], pt[1], radius, 0, 2 * Math.PI);
            Celestial.context.closePath();

            Celestial.context.stroke();
            Celestial.context.fill();

            // Draw text
            Celestial.setTextStyle(text_style);
            Celestial.context.fillText(
                d.properties.name, // Text
                pt[0] + radius - 1, // X
                pt[1] - radius + 1 // Y
            );
        }
    });
    Celestial.container.selectAll(`.watchlist-1`).each(function(d) {

        // If point is visible
        if (Celestial.clip(d.geometry.coordinates)) {

            // Get point coordinates
            let pt = Celestial.mapProjection(d.geometry.coordinates);

            let size = 15;

            Celestial.setStyle(point_style);

            // Draw a circle
            Celestial.context.beginPath();

            let hsize = size/2;
            Celestial.context.moveTo(pt[0] - hsize, pt[1] - hsize);
            Celestial.context.lineTo(pt[0] + hsize, pt[1] + hsize);
            Celestial.context.stroke();
            Celestial.context.moveTo(pt[0] - hsize, pt[1] + hsize);
            Celestial.context.lineTo(pt[0] + hsize, pt[1] - hsize);
            Celestial.context.stroke();

            // Draw text
            Celestial.setTextStyle(text_style);
            Celestial.context.fillText(
                d.properties.name, // Text
                pt[0] + size - 1, // X
                pt[1] - size + 1 // Y
            );
        }
    });
}

/**
 * Update the objects to show on the maps.
 *
 * Provide a list of objects to show. Most properties are taken directly from
 * the json database.
 *
 * The style must be an integer, -1 means that the object is from the catalog,
 * numbers from 0 represent styles from const.js:object_styles
 *
 * Example of obj argument:
 * [
 *     {
 *         "type": "Feature",
 *         "id": 43,
 *         "style": 2,
 *         "properties": {
 *             "name": "NGC 54",
 *             "dim": "1.5x3" // Size in arcminutes
 *         },
 *         "geometry":{
 *             "type": "Point",
 *             "coordinates": [-80.7653, 38.7837]
 *         }
 *     },
 *     ...
 *  ]
 *
 */
function add_map_markers(objs) {

    // Separate objs given on different lists depending on the style used
    // Each element of this object is a list of objects that share the same
    // style So you get something like
    // objs_by_class = {
    //     "catalog": [{obj}, {obj}, ...],    // Objects on catalog
    //     "wishlist-0": [{obj}, {obj}, ...], // Objects that share style 0
    //     "wishlist-1": [{obj}, {obj}, ...], // Objects that share style 1
    //     "wishlist-2": undefined,           // No objects share style 2
    //     "wishlist-3": [{obj}, {obj}, ...], // Objects that share style 3
    // ]
    let objs_by_class = {}

    for (let obj of objs) {

        let class_string = get_class_string(obj.style);

        // If this is the first object with this class, create the list
        if (typeof objs_by_class[class_string] == "undefined") {
            objs_by_class[class_string] = [];
        }

        objs_by_class[class_string].push(obj);
    }

    Celestial.add({
        type: "line",
        callback: function(error, json) {
            if (error) return console.warn(error);

            // For each group, each one with a style/class
            for (let class_string in objs_by_class) {

                // Load the given geoJSON objects and transform to correct
                // coordinate system, if necessary
                let data = Celestial.getData({
                    "type": "FeatureCollection",
                    "features": objs_by_class[class_string],
                }, config.transform);

                // Add to celestial objects container from d3 library
                // I guess that ".asterisms" is used by convention because it works
                // with any string
                Celestial.container.selectAll(".asterisms")
                    .data(data.features)
                    .enter().append("path")
                    .attr("class", class_string);
            }

            // Trigger redraw to display changes
            Celestial.redraw();
        },
        redraw: celestial_redraw,
    });

    Celestial.display(config);

    // Adding objects to aladin

    // For each group, each one with a style/class
    for (let class_string in objs_by_class) {

        // For each object in the group
        for (let obj of objs_by_class[class_string]) {

            aladin_catalogs[class_string].addSources(
                A.source(
                    obj.geometry.coordinates[0],
                    obj.geometry.coordinates[1])
            );
        }
    }

}

$(document).ready(function() {

    // Celestial.display(config);
    aladin = A.aladin('#aladin-map', {
        fov: 1,
        target: 'M31',
        reticleColor: "rgb(0, 0, 0)", // Used on coordinates text
        showReticle: false,
    });

    for (let catalog in aladin_catalogs) {
        aladin.addCatalog(aladin_catalogs[catalog]);
    }

    // TODO
    // $('#datetime-date').val(new Date().toDateInputValue());
    // $('#datetime-time').val(new Date().toDateInputValue());

    $("#datetime-submit").click(function(e) {
        e.preventDefault(); // Disable built-in HTML action
        update_map_datetime(new Date(0, 0, 0));
    });

    $("#location-submit").click(function(e) {
        e.preventDefault(); // Disable built-in HTML action
        update_map_location(-33, -63);
    });

    $("#login-form").submit(function(e) {
        e.preventDefault(); // Disable built-in HTML action
        $.ajax({
            type: "POST",
            url: "/api/v1/login",
            data: $(this).serialize(),
            dataType: "json",
        }).done(function(json) {
            test_text.innerHTML = "intentado_loguearse";
        });
    });

    $("#register-form").submit(function(e) {
        e.preventDefault(); // Disable built-in HTML action
        $.ajax({
            type: "POST",
            url: "/api/v1/login",
            data: $(this).serialize(),
            dataType: "json",
        }).done(function(json) {
            test_text.innerHTML = "intentado_registrarse";
        });
    });

    $.ajax({
        type: "GET",
        url: "/data/dsos.14.json",
        dataType: "json",
    }).done(function(dsos_data) {

        let watchlist = [
            {
                "id": data.get_id(dsos_data, "NGC104"),
                "notes": null,
                "style": 1,
            },
            {
                "id": data.get_id(dsos_data, "M31"),
                "notes": "Also known as Andromeda",
                "style": 0,
            },
            {
                id: 4613,
                "notes": null,
                "style": 1,
            },
            {
                id: 3131,
                "notes": null,
                "style": 0,
            },
            {
                id: 1692,
                "notes": null,
                "style": 1,
            },
            {
                id: 5368,
                "notes": null,
                "style": 1,
            },
            {
                id: 1809,
                "notes": null,
                "style": 0,
            },
            {
                id: 881,
                "notes": null,
                "style": 1,
            },
            {
                id: 936,
                "notes": null,
                "style": 0,
            },
            {
                id: 2218,
                "notes": null,
                "style": 1,
            },
            {
                id: 5643,
                "notes": null,
                "style": 0,
            },
            {
                id: 5917,
                "notes": null,
                "style": 1,
            },
        ]

        watchlist_create_header($("#watchlist-table thead tr"));

        let map_objects = [];
        for (let obj of watchlist) {
            watchlist_create_row(
                dsos_data,
                obj.id,
                obj.notes,
                obj.style,
                watchlist_delete,
                watchlist_save,
                function(id) { object_goto(dsos_data, id) },
            ).appendTo("#watchlist-table tbody");

            let dim = data.get_dimensions(dsos_data, obj.id);

            map_objects.push({
                "type": "Feature",
                "id": obj.id,
                "style": obj.style,
                "properties": {
                    "name": data.get_name(dsos_data, obj.id),
                    "dim": `${dim[0]}x${dim[1]}`,
                },
                "geometry":{
                    "type": "Point",
                    "coordinates": [
                        data.get_ra(dsos_data, obj.id),
                        data.get_dec(dsos_data, obj.id),
                    ],
                }
            });
        }
        add_map_markers(map_objects, 1);

        catalog_create(
            dsos_data,
            null,
            [
                {
                    id: 6217,
                    appears_on: ["Binosky"],
                },
                {
                    id: 37,
                    appears_on: ["Binosky"],
                },
                {
                    id: 4935,
                    appears_on: ["Binosky"],
                },
                {
                    id: 6055,
                    appears_on: ["Binosky"],
                },
                {
                    id: 4615,
                    appears_on: ["Binosky"],
                },
                {
                    id: 4613,
                    appears_on: ["Binosky"],
                },
                {
                    id: 4618,
                    appears_on: ["Binosky"],
                },
                {
                    id: 3131,
                    appears_on: ["Binosky"],
                },
                {
                    id: 4309,
                    appears_on: ["Binosky"],
                },
                {
                    id: 1692,
                    appears_on: ["Binosky"],
                },
                {
                    id: 5343,
                    appears_on: ["Binosky"],
                },
                {
                    id: 5368,
                    appears_on: ["Binosky"],
                },
                {
                    id: 861,
                    appears_on: ["Binosky"],
                },
                {
                    id: 1809,
                    appears_on: ["Binosky"],
                },
                {
                    id: 6654,
                    appears_on: ["Binosky"],
                },
                {
                    id: 881,
                    appears_on: ["Binosky"],
                },
                {
                    id: 908,
                    appears_on: ["Binosky"],
                },
                {
                    id: 936,
                    appears_on: ["Binosky"],
                },
                {
                    id: 1957,
                    appears_on: ["Binosky"],
                },
                {
                    id: 2218,
                    appears_on: ["Binosky"],
                },
                {
                    id: 5572,
                    appears_on: ["Binosky"],
                },
                {
                    id: 5643,
                    appears_on: ["Binosky"],
                },
                {
                    id: 5666,
                    appears_on: ["Binosky"],
                },
                {
                    id: 5917,
                    appears_on: ["Binosky"],
                },
                {
                    id: 5923,
                    appears_on: ["Binosky"],
                },
                {
                    id: 2570,
                    appears_on: ["Binosky"],
                },
            ],
            function(id) { watchlist_add(dsos_data, id) },
            function(id) { object_goto(dsos_data, id) },
        );

    });

});
