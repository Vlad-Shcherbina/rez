let reported = false;
function report_error(e: Error) {
    if (reported) return;
    reported = true;
    let div = document.createElement('div');
    div.innerText = "unhandled error, see console logs";
    div.style.backgroundColor = 'red';
    div.style.position = 'fixed';
    div.style.zIndex = '1000000';
    document.body.insertBefore(div, document.body.firstChild);
}

window.addEventListener('error', (e) => {
    report_error(e.error);
}, /* catch resource loading errors as well */ true);
window.onunhandledrejection = (e) => {
    report_error(e.reason);
};
