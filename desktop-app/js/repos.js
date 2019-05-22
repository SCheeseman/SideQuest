class Repos {
    constructor(app) {
        this.app = app;
        this.template = document.querySelector('#repoItem');
        this.menuTemplate = document.querySelector('#menuItem');
        this.repos = [];
        this.app.add_repo_button.addEventListener('click',()=>{
            this.addRepoInput(this.app.add_repo_url.value)
                .then(()=>{
                    this.openRepos();
                    this.openMenuRepos();
                    this.saveRepos();
                    this.app.add_repo_url.value = '';
                });
        });
        this.openMenuRepos();
        fs.readFile(__dirname + "/sources.txt",'utf8',(err,data)=>{
            if(!err){
                this.app.toggleLoader(true);
                this.app.spinner_loading_message.innerText = 'Loading default repos';
                setTimeout(()=>Promise.all(data.split('\n').map(url=>this.addRepo(url))).then(()=>{
                    this.openMenuRepos();
                    this.app.toggleLoader(false);
                    if(this.repos.length){
                        this.openRepo(this.repos[0])
                    }
                }));
            }
        });
    }
    deleteRepo(index){
        const cachePath = path.join(__dirname,'sources',md5(this.repos[index].url)+".json");
        if(fs.existsSync(cachePath)){
            fs.unlinkSync(cachePath);
        }
        this.repos.splice(index,1);
        this.openRepos();
        this.openMenuRepos();
    }
    saveRepos(){
        fs.writeFile(__dirname + "/sources.txt",this.repos.map(d=>d.url).join('\n'),err=>{
            if(err)alert("Failed to write sources.txt:" + err);
        });
    }
    openMenuRepos(){
        this.app.menu_container.innerHTML = '';
        this.repos.forEach((r,i)=>{
            let child = this.menuTemplate.content.cloneNode(true);
            child.querySelector('.menu-name').innerText = r.name;
            child.querySelector('.menu-icon').src = r.url+'icons/'+r.icon;
            child.querySelector('.menu-item-inner').addEventListener('click',()=>this.openRepo(r));
            this.app.menu_container.appendChild(child);
        });
    }
    async openRepo(repo){
        this.app.current_data = repo;
        this.app.add_repo.style.display = 'none';
        this.app.container.innerHTML = '<h4 class="grey-text">Loading apps...</h4>';
        this.app.searchFilterContainer.style.display = 'block';
        this.app.title.innerHTML = repo.name;
        this.app.searchFilter();
    }
    openRepos(){
        this.app.add_repo.style.display = 'block';
        this.app.container.innerHTML = '';
        this.app.searchFilterContainer.style.display = 'none';
        this.app.title.innerHTML = "F-Droid Repos";
        this.repos.forEach((r,i)=>{
            let child = this.template.content.cloneNode(true);
            child.querySelector('.repo-description').innerText = r.name+" - "+r.url;
            child.querySelector('.repo-image').src = r.url+'icons/'+r.icon;
            child.querySelector('.delete-repo').addEventListener('click',()=>{
                this.deleteRepo(i);
                this.saveRepos();
            });
            child.querySelector('.update-repo').addEventListener('click',()=>{
                let url = r.url;
                this.deleteRepo(i);
                this.addRepoInput(url)
                    .then(()=>{
                        this.saveRepos();
                        this.openRepos();
                        this.openMenuRepos();
                    });

            });
            this.app.container.appendChild(child);
        });
    }
    isValidRepo(repo){
        if(!repo) return false;
        if(!repo.repo) return false;
        if(!repo.repo.version || !(repo.repo.version > 17 && repo.repo.version < 24)) return false;
        return true;
    }
    addRepoInput(url){
        this.app.toggleLoader(true);
        return this.addRepo(url)
            .then(()=>{
                this.app.toggleLoader(false);
            })
            .catch(error=>{
                alert(error);
                this.app.toggleLoader(false);
            });
    }
    addRepo(url){
        this.app.spinner_loading_message.innerText = 'Loading '+url;
        url = url.trim();
        if(url[url.length -1] !== '/'){
            url+='/';
        }
        return new Promise(async (resolve,reject)=>{
            let isCached = false;
            const cachePath = path.join(__dirname,'sources',md5(url)+".json");
            if(fs.existsSync(cachePath)){
                isCached = true;
                await new Promise(_resolve=>{
                    fs.readFile(cachePath,'utf8',(err,data)=>{
                        if(err){
                            fs.unlink(cachePath);
                            isCached = false;
                            return _resolve();
                        }
                        try{
                            let source = JSON.parse(data);
                            resolve(source);
                            _resolve();
                        }catch(e){
                            fs.unlink(cachePath);
                            isCached = false;
                            _resolve();
                        }
                    })
                })
            }
            if(isCached)return;
            if(~this.repos.map(d=>d.url).indexOf(url)){
                reject("Repo already added!");
            }
            const jsonUrl = url+'index-v1.json';
            request(jsonUrl, (error, response, body)=>{
                if(error){
                    return reject(error);
                }else{
                    fs.writeFile(__dirname+'/sources/'+md5(url)+".json",body,err=>{
                        if(err)alert("Failed to cache source ( url ):" + err);
                    });
                    let repo_body = JSON.parse(body);
                    if(!this.isValidRepo(repo_body)){
                        reject("Repo not valid or unsupported version!");
                    }else{
                        resolve(repo_body);
                    }
                }
            })
        }).then(repo=>{
            this.repos.push({name:repo.repo.name,icon:repo.repo.icon,url:url,body:repo,categories:repo.apps.reduce((a,b)=>{
                b.icon = url+"icons/"+b.icon;
                return a.concat(b.categories);
            },[]).filter((v,i,self)=>self.indexOf(v) === i)});
        })
    }
}