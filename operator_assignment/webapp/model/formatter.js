sap.ui.define([], function () {
  "use strict";

  var oFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

  function qty(vValue) {
    if (vValue === null || vValue === undefined || vValue === "") {
      return vValue;
    }
    var fValue = parseFloat(vValue);
    return isNaN(fValue) ? vValue : oFormat.format(fValue);
  }

  return {
    qty: qty,

    qtyWithUnit: function (vValue, sUnit) {
      return qty(vValue) + " " + (sUnit || "");
    },
  };
});
