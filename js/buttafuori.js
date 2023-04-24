var userAgent = navigator.userAgent;
if (!navigator.serial || userAgent.indexOf("MSIE") != -1 || userAgent.indexOf("Trident") != -1 || userAgent.indexOf("K-Meleon") != -1) {
    window.location.href = "oldbrowser.html";
}