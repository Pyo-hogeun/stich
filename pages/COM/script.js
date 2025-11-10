import Sortable from "../../node_modules/sortablejs/modular/sortable.esm.js";
var el = document.getElementById('items');
var sortable = new Sortable.create(el,{
    animation: 200,
});