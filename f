git clone https://github.com/Azure/azure-managed-hsm-key-attestation
wget https://bootstrap.pypa.io/get-pip.py
sudo python3 get-pip.py
sudo apt install python3.10-venv
python3 -m venv attestation
source attestation/bin/activate
pip3 install -r requirements.txt
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
cd src/
az login
az rest --method get \
--uri https://masters-managed-hsm.managedhsm.azure.net/keys/CVM-file-1000-txt/72c320703e3e031db75773d9158ee80f/attestation?api-version=7.6-preview.1 \
--resource https://managedhsm.azure.net \
> attestation.json
python3 validate_attestation.py -af attestation.json 