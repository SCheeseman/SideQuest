const adb = require('adbkit');
const adbTools = require('android-platform-tools');
const fs = require('fs');
const path = require('path');
var request = require('request')
var Readable = require('stream').Readable;

class Setup {
    constructor(app) {
        this.app = app;
        this.devicePackages = [];
        this.deviceStatus = 'disconnected';
        this.deviceSerial = '';
        this.adbPath = path.join(process.cwd(),'platform-tools','adb.exe');
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
                statusMessage.innerText = 'Warning: Please connect only one android device to your PC';
                break;
            case "connected":
                statusMessage.innerText = 'Connected';
                break;
            case "disconnected":
                statusMessage.innerText = 'Disconnected: Connect your headset via USB';
                break;
            case "unauthorized":
                statusMessage.innerText = 'Unauthorized: Put your headset on and click always allow and then OK';
                break;
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
        console.log(this.deviceIp, this.deviceSerial);
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
            await adbTools.downloadTools();
        }
        this.adb = adb.createClient({bin:this.adbPath});
        this.connection_refresh.addEventListener('click',async ()=>this.updateConnectedStatus(await this.connectedStatus()));
    }
    async connectedStatus(){
        this.connection_refresh.innerText = 'more_horiz';
        return this.adb.listDevices()
            .then((devices) =>{
                console.log(devices);
                this.connection_refresh.innerText = 'refresh';
                if(devices.length === 1){
                    this.deviceSerial = devices[0].id;
                    this.getPackages();
                    // this.getIpAddress()
                    //     .then(()=>this.showHideWifiButton());
                    return devices[0].type === 'unauthorized'?devices[0].type:'connected';
                }else{
                    if(devices.length > 1) {
                        return 'too-many';
                    }else{
                        return 'disconnected';
                    }
                }
            });
    }
}