const adb = require('adbkit');
const extract = require('extract-zip');
const os = require('os');
const fs = require('fs');
const path = require('path');
let request = require('request')
let Readable = require('stream').Readable;

class Setup {
    constructor(app) {
        this.app = app;
        this.devicePackages = [];
        this.deviceStatus = 'disconnected';
        this.deviceSerial = '';
        this.adbPath = path.join(process.cwd(),'platform-tools');
        this.connection_refresh = document.getElementById('connection-refresh');
        this.setupAdb()
            .then(async ()=>this.updateConnectedStatus(await this.connectedStatus()));
    }
    isAdbDownloaded(){
        try {
            return fs.existsSync(this.adbPath);
        } catch(err) {
            return false;
        }
    }
    updateConnectedStatus(status){
        this.deviceStatus = status;
        document.getElementById('connection-status').className = 'connection-status-'+status;
        let statusMessage = document.getElementById('connection-status-message');
        switch(status){
            case "too-many":
                statusMessage.innerText = 'Warning: Please connect only one android device to your PC - <a class="help-link">Help</a>';
                break;
            case "connected":
                statusMessage.innerText = 'Connected';
                break;
            case "disconnected":
                statusMessage.innerHTML = 'Disconnected: Connect/Reconnect your headset via USB - <a class="help-link">Help</a>';
                break;
            case "unauthorized":
                statusMessage.innerText = 'Unauthorized: Put your headset on and click always allow and then OK - <a class="help-link">Help</a>';
                break;
        }
        let help = document.querySelector('.help-link');
        if(help){
            help.addEventListener('click',()=>{
                this.app.openSetupScreen();
            });
        }
        if(this.deviceStatus !== 'connected'){
            document.getElementById('connection-ip-address').innerHTML = '';
            this.app.enable_wifi.style.display = 'none';
        }
    }
    installApk(url){
        return this.adb.install(this.deviceSerial, new Readable().wrap(request(url)));
    }
    uninstallApk(pkg){
        return this.adb.uninstall(this.deviceSerial, pkg);
    }
    enableWifiMode(){
        if(this.showHideWifiButton()){
            return this.adb.usb(this.deviceSerial)
                .then(()=>this.adb.kill())
                .then(async ()=>{
                    setTimeout(async ()=>this.updateConnectedStatus(await this.connectedStatus()),5000);
                    alert('You can now reconnect the USB cable.');
                })
        }else{
            return this.adb.tcpip(this.deviceSerial, 5556)
                .then(()=>this.adb.connect(this.deviceIp,5556))
                .then(()=>this.adb.kill())
                .then(()=>{
                    setTimeout(async ()=>this.updateConnectedStatus(await this.connectedStatus()),5000);
                    alert('You can now disconnect the USB cable.');
                })
        }
    }
    getIpAddress(){
        //this.app.enable_wifi.style.display = 'block';
        return this.adb.shell(this.deviceSerial,'ip route')
            .then(adb.util.readAll)
            .then(res=>{
                let output_parts = res.toString().trim().split(" ");
                this.deviceIp = output_parts[output_parts.length-1];
                document.getElementById('connection-ip-address').innerHTML = 'Device IP<br>'+output_parts[output_parts.length-1];
            })
    }
    showHideWifiButton(){
        if(this.deviceIp && this.deviceSerial === this.deviceIp+":5556"){
            this.app.enable_wifi.innerText = 'USB Mode';
            return true;
        }else{
            this.app.enable_wifi.innerText = 'Wifi Mode';
            return false;
        }
    }
    getPackages(){
        this.adb.getPackages(this.deviceSerial)
            .then(packages=>{
                this.devicePackages = packages;
                this.app.searchFilter();
            });
    }
    async setupAdb(){
        if(!this.isAdbDownloaded()){
            await this.downloadTools();
        }
        this.adb = adb.createClient({bin:path.join(this.adbPath,this.getAdbBinary())});
        this.connection_refresh.addEventListener('click',async ()=>this.updateConnectedStatus(await this.connectedStatus()));
    }
    async connectedStatus(){
        this.connection_refresh.innerText = 'more_horiz';
        return this.adb.listDevices()
            .then((devices) =>{
                this.connection_refresh.innerText = 'refresh';
                if(devices.length === 1){
                    this.deviceSerial = devices[0].id;
                    if(devices[0].type === 'device') {
                        this.getPackages();
                        // this.getIpAddress()
                        //     .then(()=>this.showHideWifiButton());
                        return 'connected';
                    }else if(devices[0].type === 'offline') {
                        return 'disconnected';
                    }else{
                        return 'unauthorized';
                    }
                }else{
                    if(devices.length > 1) {
                        return 'too-many';
                    }else{
                        return 'disconnected';
                    }
                }
            })
            .catch(err=>{
                console.log(err);
            });
    }
    getUserAgent() {
        const nodeString = `NodeJs/${process.version}`;
        const packageString = 'OpenStoreVR';
        const computerString = `Hostname/${os.hostname()} Platform/${os.platform()} PlatformVersion/${os.release()}`;
        return `${packageString} ${nodeString} ${computerString}`;
    }
    getAdbBinary(){
        switch (os.platform()) {
            case 'win32':
                return 'adb.exe';
            default:
                return 'adb';
        }
    }
    async downloadTools(){
        const WINDOWS_URL = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';
        const LINUX_URL = 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip';
        const OSX_URL = 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip';
        let downloadUrl = LINUX_URL;
        switch (os.platform()) {
            case 'win32':
                downloadUrl = WINDOWS_URL;
                break;
            case 'darwin':
                downloadUrl = OSX_URL;
                break;
            case 'linux':
                downloadUrl = LINUX_URL;
                break;
        }
        let zipPath = this.adbPath+".zip";
        const requestOptions = {timeout: 30000, 'User-Agent': this.getUserAgent()};
        return new Promise((resolve,reject)=>{
            request(downloadUrl, requestOptions)
                .on('error', (error)  => {
                    debug(`Request Error ${error}`);
                    reject(error);
                })
                .pipe(fs.createWriteStream(zipPath))
                .on('finish', ()  => {
                    extract(zipPath, {dir: process.cwd()},(error) => {
                        if(error) {
                            reject(error);
                        }else{
                            fs.unlink(zipPath, (err) => {
                                resolve();
                            });
                        }
                    });
                });
        })
    }
}